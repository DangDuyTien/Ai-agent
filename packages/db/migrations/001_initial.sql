CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  raw_idea TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'new_project',
  source_path TEXT,
  project_type TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'draft',
  confidence NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE project_artifacts (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  artifact_type TEXT NOT NULL,
  version INT NOT NULL,
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  created_by_agent TEXT NOT NULL,
  approved_by_user BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (project_id, artifact_type, version)
);

CREATE TABLE agent_runs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  error TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT now(),
  finished_at TIMESTAMP
);

CREATE TABLE project_tasks (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  parent_task_id UUID,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  task_type TEXT NOT NULL,
  target_area TEXT NOT NULL,
  acceptance_criteria JSONB NOT NULL,
  dependencies JSONB NOT NULL,
  status TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE agent_logs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  agent_run_id UUID REFERENCES agent_runs(id),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE memories (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_artifacts_project_type ON project_artifacts(project_id, artifact_type);
CREATE INDEX idx_agent_runs_project ON agent_runs(project_id, started_at DESC);
CREATE INDEX idx_agent_logs_project ON agent_logs(project_id, created_at DESC);
