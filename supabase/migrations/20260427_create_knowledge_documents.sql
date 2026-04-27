-- =================================================================================
-- 启用 pgvector 扩展 + 创建知识文档表 (Corrective RAG 知识库)
-- 用于存储向量化的平台图片处理指南，支持语义相似度检索
-- =================================================================================

-- 1. 启用 pgvector 向量扩展
create extension if not exists vector with schema extensions;

-- 2. 创建知识文档表
create table if not exists public.knowledge_documents (
  id          bigserial primary key,
  scene       text not null,            -- 场景标签: 'shopify' | 'amazon' | 'blog' | 'seo' | 'general'
  source      text not null,            -- 来源标识: 'shopify-docs' | 'amazon-seller-central' 等
  title       text not null,            -- 知识片段标题
  content     text not null,            -- 原始文本内容
  embedding   vector(1024),             -- BAAI/bge-m3 输出维度 (1024)
  metadata    jsonb default '{}',       -- 扩展元数据 (平台版本、更新时间等)
  created_at  timestamptz not null default timezone('utc'::text, now())
);

-- 3. 创建向量相似度索引 (余弦距离，IVFFlat)
-- lists 参数根据数据量调整：初始阶段数据少，lists=5 足够
create index if not exists idx_knowledge_documents_embedding
  on public.knowledge_documents
  using ivfflat (embedding vector_cosine_ops) with (lists = 5);

-- 4. 创建 RPC 函数：供 LangChain SupabaseVectorStore 调用
-- 按余弦相似度检索 Top-K 知识片段
create or replace function public.match_knowledge_documents(
  query_embedding vector(1024),
  match_count int default 3,
  filter jsonb default '{}',
  match_threshold float default 0.3
)
returns table (
  id          bigint,
  content     text,
  metadata    jsonb,
  similarity  float
)
language plpgsql
as $$
begin
  return query
  select
    kd.id,
    kd.content,
    jsonb_build_object(
      'id', kd.id,
      'scene', kd.scene,
      'source', kd.source,
      'title', kd.title
    ) as metadata,
    1 - (kd.embedding <=> query_embedding) as similarity
  from public.knowledge_documents kd
  where kd.embedding is not null
    and 1 - (kd.embedding <=> query_embedding) >= match_threshold
  order by kd.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 5. 创建唯一索引 (scene + title)，用于知识灌入脚本的幂等 upsert
create unique index if not exists idx_knowledge_documents_scene_title
  on public.knowledge_documents (scene, title);
