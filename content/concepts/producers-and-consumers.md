---
name: producers-and-consumers
title: Producers and Consumers
description: The two endpoint roles in Camel, how routes start and send, and the consumer/producer flags exposed by the catalog.
labels: core,endpoint
source: https://camel.apache.org/components/4.23.x/index.html
---

Every Camel endpoint can play one or both roles:

- A consumer starts work. It receives or polls for data, creates an exchange, and starts the route.
- A producer sends an exchange to another system or endpoint.

In a route, `from(...)` is the consumer side and `to(...)` / `toD(...)` are the producer side. A single component can support both roles. For example, `kafka:` can consume topics and produce to them, while `direct:` is a local in-memory bridge between routes.

Catalog flags:

- `consumerOnly`: the component can only be used in `from(...)`.
- `producerOnly`: the component can only be used in `to(...)`.
- `async`: the producer is asynchronous and does not block waiting for completion.
- `api`: the component is based on an API or API proxy pattern.
- `browsable`: the component supports browsing messages, useful for diagnostics.

Consumer styles:

- Event-driven consumers are notified by the transport when a message arrives (JMS listener, Kafka poll loop, HTTP server).
- Polling consumers call the remote system on a schedule (`file`, `aws2-sqs`, `sql`, `ftp`). Many expose `delay`, `initialDelay`, `useFixedDelay`, `maxMessagesPerPoll`, and `greedy` options.
- Scheduled consumers such as `timer:` and `quartz:` create messages on a schedule and are useful for batch jobs and health checks.

Producer styles:

- Synchronous producers block until the remote call completes.
- Asynchronous producers return immediately; errors surface through the exchange or an async callback.
- `toD(...)` computes the destination URI dynamically per exchange. Use it for content-based routing to many destinations, and avoid computing unbounded URI sets that create endpoint leaks.

Producer templates:

```java
@Autowired ProducerTemplate template;

template.sendBody("direct:orders", order);
template.requestBody("direct:validate", order, OrderResult.class);
```

`ProducerTemplate` is convenient from outside routes, tests, and scheduled jobs. Inside a route, prefer `to(...)` and EIPs so error handling and route context stay consistent.
