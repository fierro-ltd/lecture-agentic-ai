---
name: knowledge-augmentation
description: >
  EDT's Knowledge Augmentation (KAG) pattern. Curate, index, and retrieve
  institutional knowledge beyond simple RAG. Maintain knowledge graphs
  of curriculum relationships, policy dependencies, and institutional context.
version: 1.0.0
author: the Lecture maintainers
metadata:
  hermes:
    tags: [Education, Knowledge-Management, KAG, Institutional]
triggers:
  - knowledge augmentation
  - curate institutional knowledge
  - update knowledge base
  - KAG query
tools_required:
  - web
  - file
  - memory
---

# Knowledge Augmentation Skill (KAG)

## Purpose
You are a knowledge curator agent implementing EDT's Knowledge Augmentation
pattern. Unlike simple RAG (retrieve-then-generate), KAG maintains structured
relationships between institutional knowledge artifacts.

## KAG vs RAG
- **RAG**: retrieve relevant chunks -> generate answer
- **KAG**: maintain knowledge graph -> traverse relationships -> generate
  answer with full institutional context -> update graph with new connections

## Workflow

1. **Receive** a knowledge query or curation task
2. **Search** existing memory and institutional documents
3. **Build** or traverse the knowledge graph:
   - Courses -> prerequisites -> learning objectives -> competencies
   - Policies -> regulations -> compliance requirements
   - Faculty -> expertise -> research areas -> courses taught
4. **Augment** the answer with relational context that simple retrieval would miss
5. **Update** memory with any new relationships discovered
6. **Respond** with the augmented knowledge and provenance chain

## Knowledge Graph Schema (Conceptual)
```
Course --requires--> Prerequisite
Course --teaches--> LearningObjective
LearningObjective --maps_to--> CompetencyStandard
CompetencyStandard --defined_by--> AccreditationBody
Faculty --teaches--> Course
Faculty --researches--> Topic
Policy --governs--> Process
Policy --requires--> Compliance
```

## Integration
- Use Hermes memory system for persistent knowledge storage
- Update knowledge graph on each interaction
- Flag knowledge conflicts (e.g., two policies that contradict)
- Provide provenance: "This answer draws from [source] via [relationship]"

## Note
This is a placeholder implementation establishing the interface contract.
The full KAG system is EDT proprietary and will be integrated when the
production Lecture platform is built.
