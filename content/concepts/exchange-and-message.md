---
name: exchange-and-message
title: Exchange and Message Model
description: The Exchange, Message, headers, properties, variables, attachments, and exchange patterns that every Camel route processes.
labels: core,message
source: https://camel.apache.org/manual/exchange.html
---

The `Exchange` is the unit of work that travels through a route. It carries the message, metadata, and control information used by processors and EIPs.

An exchange contains:

- A `Message` with a body, headers, and optional attachments.
- Exchange properties: metadata about the exchange that is not part of the message itself.
- An exchange ID, a from endpoint, and the current exchange pattern.
- The exception, if processing failed.
- A unit of work, used by transactions and synchronization callbacks.
- Route-scoped variables in Camel 4 (`setVariable`, `${variable.name}`).

Message headers are string-keyed values that travel with the message and are typically mapped to transport headers (HTTP headers, JMS properties, Kafka headers, SQS message attributes). Exchange properties stay inside Camel and are not sent to the next system unless a component explicitly maps them.

```java
from("direct:start")
    .setHeader("tenant", constant("acme"))
    .setProperty("traceId", exchangeProperty("traceId"))
    .setVariable("attempt", constant(1))
    .setBody(simple("Hello ${header.tenant}"));
```

Exchange patterns:

- `InOnly` is fire-and-forget. The producer does not wait for a reply.
- `InOut` is request-reply. The producer waits for the exchange to come back with a response.
- Components decide which patterns they support. Many support both; some are producer-only or consumer-only.
- `ExchangePattern` is set on the exchange and can be changed with `setExchangePattern(...)` or by using `inOnly(...)` / `inOut(...)`.

Important practices:

- Prefer headers for message metadata that must cross a transport boundary.
- Prefer exchange properties for routing and observability metadata that should stay local.
- Prefer variables for state scoped to a single route or EIP branch.
- Do not rely on mutating the same body object across threads. Camel exchanges are mutable; copy data when parallel branches need independent bodies.
- The message body type is dynamic. Use `convertBodyTo(...)`, `bodyAs(...)`, or type converters rather than casting blindly.

The exchange is also where error state lives. When a processor throws, the exception is set on the exchange and the error handler decides whether to retry, route to a dead letter endpoint, or fail the route.
