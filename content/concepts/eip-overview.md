---
name: eip-overview
title: Enterprise Integration Patterns Overview
description: The main EIP groups and their Camel implementations, from routing and transformation to messaging endpoints and management.
labels: core,eip,routing
source: https://camel.apache.org/components/4.23.x/eips/index.html
---

Camel implements the Enterprise Integration Patterns as route EIPs. Each has a DSL keyword, options, and usually a catalog doc.

Routing:

- Content-Based Router: `choice` / `when` / `otherwise`.
- Message Filter: `filter`.
- Recipient List: `recipientList`, or `toD` for a single dynamic destination.
- Splitter: `split`.
- Aggregator: `aggregate` (aliases: fan-in, reduce, join, merge).
- Multicast: `multicast`.
- Dynamic Router: `dynamicRouter`.
- Load Balancer: `loadBalance` with round-robin, random, failover, weighted, and sticky strategies.
- Routing Slip: `routingSlip`.
- Resequencer: `resequence`.
- Throttler and Sampler: `throttle`, `sample`.

Transformation:

- Message Translator: `transform`, `setBody`, `bean`.
- Content Enricher: `enrich` and `pollEnrich`.
- Claim Check: `claimCheck`.
- Normalizer: `normalizer`.
- Marshal/unmarshal with data formats.

Messaging channels and endpoints:

- Point-to-Point Channel: `seda` or a queue.
- Publish-Subscribe Channel: `multicast`, topics.
- Dead Letter Channel: `deadLetterChannel` or `onException`.
- Guaranteed Delivery: persistent queues plus transactions or idempotency.
- Message Expiration: headers and component TTL options.
- Correlation Identifier: headers plus `aggregate` or `idempotentConsumer`.
- Idempotent Consumer: `idempotentConsumer` with a repository.
- Selective Consumer: `filter` at the consumer.
- Competing Consumers: concurrent consumers on a queue.
- Message Dispatcher and Durable Subscriber: broker- and component-specific.

System management:

- Wire Tap: `wireTap`.
- Message History: `messageHistory`.
- Log: `log`.
- Intercept: `intercept`, `interceptFrom`, `interceptSendToEndpoint`.
- Control Bus: `controlbus` for managing routes and context at runtime.

Use `list_eips` for the full catalog, `get_eip(name)` for options and exchange properties, and the `guide` docs for pattern-level explanations such as `message-router`, `content-enricher`, `scatter-gather`, `dead-letter-channel`, and `correlation-identifier`.

EIP selection guidance:

- Use `choice` for small, static routing decisions; use `recipientList` or `toD` for dynamic destinations.
- Use `split` for independent items and `aggregate` for correlated completion.
- Use `idempotentConsumer` when duplicate delivery is possible and the downstream is not idempotent.
- Use `wireTap` for observability instead of adding side effects to the main route.
