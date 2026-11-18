"""Stage 2: Reviewed Hard Negative Fine-Tuning using TripletLoss.

Specification: Section 10.4 & Milestone 2 O2
Loss: TripletLoss with cosine distance
Grid search: margins {0.1, 0.2, 0.3}, lr {1e-5, 2e-5}
"""

from __future__ import annotations

import json
from pathlib import Path
import torch
from torch.utils.data import DataLoader, Dataset
from sentence_transformers import SentenceTransformer, losses, InputExample

NEGATIVES_FILE = Path("ml/data/negatives/negatives.jsonl")
STAGE1_CHECKPOINT = Path("ml/runs/stage1_checkpoint")
STAGE2_OUTPUT_DIR = Path("ml/runs/stage2_checkpoint")


class TripletDataset(Dataset):
    def __init__(self, triplets: list[tuple[str, str, str]]):
        # (anchor, positive, negative)
        self.triplets = triplets

    def __len__(self):
        return len(self.triplets)

    def __getitem__(self, idx):
        a, p, n = self.triplets[idx]
        return InputExample(texts=[a, p, n])


def train_stage2(
    stage1_model_path: str = str(STAGE1_CHECKPOINT),
    margin: float = 0.2,
    lr: float = 1e-5,
    epochs: int = 2,
    batch_size: int = 16,
    seed: int = 42,
):
    torch.manual_seed(seed)
    STAGE2_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    triplets = []
    with open(NEGATIVES_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                t = json.loads(line)
                triplets.append((t["anchor_text"], t["positive_text"], t["negative_text"]))

    print(f"Loaded {len(triplets)} reviewed triplets for Stage 2 training.")

    dataset = TripletDataset(triplets)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    # Load Stage 1 checkpoint or fall back to base
    if Path(stage1_model_path).exists():
        print(f"Loading Stage 1 checkpoint from {stage1_model_path}")
        model = SentenceTransformer(stage1_model_path)
    else:
        print("Stage 1 checkpoint not found, starting from base all-MiniLM-L6-v2")
        model = SentenceTransformer("all-MiniLM-L6-v2")

    train_loss = losses.TripletLoss(
        model=model,
        distance_metric=losses.TripletDistanceMetric.COSINE,
        triplet_margin=margin,
    )

    warmup_steps = int(len(dataloader) * epochs * 0.10)
    print(f"Starting Stage 2 Triplet training: margin={margin}, lr={lr}, epochs={epochs}...")

    model.fit(
        train_objectives=[(dataloader, train_loss)],
        epochs=epochs,
        warmup_steps=warmup_steps,
        optimizer_params={"lr": lr},
        output_path=str(STAGE2_OUTPUT_DIR),
        show_progress_bar=True,
    )

    print(f"Stage 2 fine-tuning complete. Checkpoint saved to {STAGE2_OUTPUT_DIR}")
    return STAGE2_OUTPUT_DIR


if __name__ == "__main__":
    train_stage2()

