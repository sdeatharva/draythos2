"""Stage 1: Contrastive Fine-Tuning using MultipleNegativesRankingLoss.

Specification: Section 10.3 & Milestone 2 O2
Loss: MultipleNegativesRankingLoss (temperature 0.05 / scale 20)
Sampler: ConceptDistinctBatchSampler
Base model: sentence-transformers/all-MiniLM-L6-v2
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import torch
from torch.utils.data import DataLoader, Dataset
from sentence_transformers import SentenceTransformer, losses, InputExample

from ml.train.sampler import ConceptDistinctBatchSampler

VARIANTS_FILE = Path("ml/data/variants/variants.jsonl")
TAXONOMY_FILE = Path("ml/data/taxonomy/taxonomy.jsonl")
SPLIT_FILE = Path("ml/data/splits/split_main.json")
OUTPUT_MODEL_DIR = Path("ml/runs/stage1_checkpoint")


class ConceptPairsDataset(Dataset):
    def __init__(self, pairs: list[tuple[str, str, str]]):
        # (text_a, text_b, concept_id)
        self.pairs = pairs

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        a, b, cid = self.pairs[idx]
        return InputExample(texts=[a, b], label=cid)


def train_stage1(
    base_model_name: str = "all-MiniLM-L6-v2",
    batch_size: int = 16,
    epochs: int = 2,
    lr: float = 2e-5,
    seed: int = 42,
):
    torch.manual_seed(seed)
    OUTPUT_MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Load taxonomy canonical labels
    canon_labels = {}
    with open(TAXONOMY_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                c = json.loads(line)
                canon_labels[c["concept_id"]] = c["label"]

    # 2. Load train examples
    with open(SPLIT_FILE, "r", encoding="utf-8") as f:
        split = json.load(f)
    train_ids = set(split["train"])

    train_pairs = []
    concept_ids = []

    with open(VARIANTS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                r = json.loads(line)
                if r["example_id"] in train_ids and r.get("relation") == "equivalent":
                    cid = r["concept_id"]
                    text = r["text"]
                    canon = canon_labels.get(cid, text)
                    # Pair: (variant, canonical_label)
                    train_pairs.append((text, canon, cid))
                    concept_ids.append(cid)

    print(f"Loaded {len(train_pairs)} pairs across {len(set(concept_ids))} concepts for Stage 1 MNRL.")

    # 3. Build Concept-Distinct Dataloader
    dataset = ConceptPairsDataset(train_pairs)
    sampler = ConceptDistinctBatchSampler(
        concept_ids=concept_ids,
        batch_size=batch_size,
        shuffle=True,
        seed=seed,
    )

    def collate_fn(batch):
        return batch

    train_dataloader = DataLoader(dataset, batch_sampler=sampler)

    # 4. Initialize Model and Loss
    try:
        model = SentenceTransformer(base_model_name)
    except Exception as e:
        print(f"Warning: Loading local base model or fallback: {e}")
        model = SentenceTransformer("all-MiniLM-L6-v2")

    train_loss = losses.MultipleNegativesRankingLoss(model, scale=20.0)

    # 5. Fine-tune
    warmup_steps = int(len(train_dataloader) * epochs * 0.10)
    print(f"Starting Stage 1 fine-tuning: {epochs} epochs, lr={lr}, warmup_steps={warmup_steps}...")

    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=epochs,
        warmup_steps=warmup_steps,
        optimizer_params={"lr": lr},
        output_path=str(OUTPUT_MODEL_DIR),
        show_progress_bar=True,
    )

    print(f"Stage 1 fine-tuning complete. Checkpoint saved to {OUTPUT_MODEL_DIR}")
    return OUTPUT_MODEL_DIR


if __name__ == "__main__":
    train_stage1()

