---
name: components-and-labels
title: Components, Schemes, and Labels
description: How components map to URI schemes and Maven artifacts, what support levels mean, and which component families are commonly used.
labels: core,components
source: https://camel.apache.org/components/4.23.x/index.html
---

A component is a plugin that creates endpoints for one URI scheme. The `kafka` component handles `kafka:...`; the `file` component handles `file:...`. Most components live in their own Maven artifact named `camel-<component>`.

The catalog exposes for each component:

- `name` and `scheme` (they usually match, but aliases exist).
- `syntax`, the expected URI shape.
- `groupId` and `artifactId` for the dependency.
- `label`, a comma-separated set of categories such as `cloud`, `messaging`, `file`, `http`, `ai`, `core`.
- `supportLevel`: Stable, Preview, Experimental, or Deprecated.
- `consumerOnly` / `producerOnly` and asynchronous behavior.

Common families:

- Core: `direct`, `seda`, `vm`, `timer`, `quartz`, `log`, `bean`, `mock`, `dataset`, `controlbus`.
- File and transfer: `file`, `ftp`, `sftp`, `ftps`.
- HTTP and APIs: `http`, `netty-http`, `undertow`, `platform-http`, `rest`, `openapi`.
- Messaging: `kafka`, `jms`, `amqp`, `activemq`, `pulsar`, `aws2-sqs`, `aws2-sns`.
- Cloud storage and events: `aws2-s3`, `aws2-eventbridge`, `azure-storage-blob`, `google-storage`.
- Data and databases: `sql`, `jdbc`, `jpa`, `mongodb`, `redis`, `elasticsearch`.
- Transformation: `jackson`, `csv`, `jaxb`, `dataformat`, `base64`, `crypto`.
- Resilience and observability: `resilience4j`, `micrometer`, `opentelemetry`, `zipkin`.
- AI: `langchain4j`, `openai`, `docling`, `mcp`.

Choosing a component:

- Prefer a component that matches the transport and supports the exchange pattern you need.
- Check `supportLevel` and the catalog doc before adopting a Preview or Experimental component.
- Check whether the component is consumer-only, producer-only, or both.
- Add the matching `camel-<name>` dependency; in Spring Boot, prefer the starter if one exists.

Use this MCP to explore:

- `list_components(label="messaging")` to see a family.
- `search_camel("send file to s3")` for intent-based discovery.
- `get_component("aws2-s3", includeOptions=true)` for URI syntax and options.
