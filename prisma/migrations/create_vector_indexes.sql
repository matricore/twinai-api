-- Vector indexes for pgvector semantic search
-- Run this after db:push

-- HNSW index for memories (faster, more memory)
CREATE INDEX IF NOT EXISTS memories_embedding_idx 
ON memories 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- HNSW index for messages
CREATE INDEX IF NOT EXISTS messages_embedding_idx 
ON messages 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- HNSW index for insights
CREATE INDEX IF NOT EXISTS insights_embedding_idx 
ON insights 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Note: HNSW (Hierarchical Navigable Small World) index is faster for search
-- but uses more memory. For smaller datasets, IVFFlat might be better.
-- 
-- Alternative: IVFFlat index (less memory, needs training data)
-- CREATE INDEX ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

