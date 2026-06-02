# Embedding Models Directory

This directory contains pre-trained embedding models used for document vectorization and similarity search.

## Purpose

Embedding models convert text documents into numerical vectors (embeddings) that capture semantic meaning. These vectors are used in the RAG system for:

- Document retrieval based on semantic similarity
- Matching user queries with relevant knowledge base content
- Enabling context-aware AI responses

## Included Models

### all-MiniLM-L6-v2
- **Type**: English text embedding model
- **Size**: Small (fast inference)
- **Use case**: General purpose English text embedding
- **Provider**: Sentence Transformers

### bge-base-zh-v1.5
- **Type**: Chinese text embedding model
- **Size**: Medium (balanced performance)
- **Use case**: Chinese text embedding for knowledge retrieval
- **Provider**: BAAI (Beijing Academy of Artificial Intelligence)

## Model Structure

Each model directory contains:
- Model weights (`pytorch_model.bin` or `model.safetensors`)
- Configuration files (`config.json`)
- Tokenizer files (`tokenizer.json`, `vocab.txt`)
- Sentence Transformers config (`config_sentence_transformers.json`)

## Usage

The RAG service automatically loads models from this directory. No manual configuration is required.

## Notes

- Model files are large and not included in version control by default
- Use `git lfs` if you need to track model files in version control
- Download models from official sources and place them in this directory
- Ensure proper licensing for commercial use