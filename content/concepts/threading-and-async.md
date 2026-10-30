---
name: threading-and-async
title: Threading and Async Processing
description: How Camel routes use threads, when to add concurrency, and the tradeoffs of SEDA, parallel processing, and async producers.
labels: core,performance
source: https://camel.apache.org/manual/threading-model.html
---

Camel routes are synchronous by default. The consumer thread runs the route and calls each processor and producer in order. This is simple and keeps ordering, error handling, and transactions predictable.

Concurrency is opt-in. Common mechanisms:

- `parallelProcessing()` on EIPs such as `split`, `multicast`, `recipientList`, and `aggregate` runs branches concurrently.
- `threads(n)` or `executorService(...)` moves subsequent steps onto a pool.
- `seda:name?concurrentConsumers=n` decouples producer and consumer with an in-memory queue and worker pool.
- `vm:name` does the same across Camel contexts in the same JVM.
- `disruptor:` provides a high-throughput, low-latency queue.
- `async` / `lazyStartProducer` component options let some producers return before remote work completes.

SEDA example:

```java
from("direct:ingest")
    .to("seda:enrich?concurrentConsumers=8&queueSize=1000");

from("seda:enrich")
    .to("bean:enricher")
    .to("kafka:enriched?brokers={{kafka.brokers}}");
```

Tradeoffs:

- Parallelism breaks ordering unless you preserve keys or use an aggregator/resequencer.
- Shared mutable state needs synchronization or immutable messages.
- Thread pools need bounded queues; unbounded queues hide overload until memory runs out.
- Error handling across threads is harder. Exceptions on async branches are not always visible to the calling route.
- Transactions and security context do not automatically propagate to new threads.

Configuring pools:

- Use `threadPoolProfile` / `ThreadPoolProfileBuilder` or the `threads()` DSL to define pool sizes and rejection policies.
- Size pools from measured throughput and downstream limits, not guesses.
- Prefer backpressure (bounded queues, throttling, bulkheads) over unbounded concurrency.

Async and reactive:

- Some components are inherently async (`netty`, `vertx`, `reactive-streams`). Their options and thread models differ from blocking components.
- `ExchangePattern.InOnly` avoids waiting for a reply where the protocol permits it.
- Do not block event-loop threads with synchronous database or HTTP calls; offload to a worker pool.

For IG routes, keep the default synchronous model unless a specific integration needs fan-out or decoupling, and make queue depths and retry behavior explicit.
