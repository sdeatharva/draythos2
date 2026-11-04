# Draythos Production Dockerfile for Railway / Cloud Container Deployments
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    VHAGAR_DB_PATH=/app/data/draythos.db \
    VHAGAR_DOCUMENTS_DIR=/app/data/documents \
    VHAGAR_WORKING_COPIES_DIR=/app/data/working_copies \
    VHAGAR_PORT=8001 \
    VHAGAR_HOST=0.0.0.0

# Install system dependencies (build-essential, poppler, tesseract for OCR)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    poppler-utils \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .
RUN pip install -e .

# Create volume storage mount point
RUN mkdir -p /app/data/documents /app/data/working_copies /app/data/cache

EXPOSE 8001

CMD ["python3", "-m", "uvicorn", "vhagar.mcp_server:create_mcp_app", "--factory", "--host", "0.0.0.0", "--port", "8001"]

