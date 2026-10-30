---
name: error-handling
title: Error Handling
description: Default and custom error handlers, try/catch/finally, onException, retries, redelivery, and dead letter channels.
labels: core,resilience
source: https://camel.apache.org/manual/error-handler.html
---

Camel has two related error mechanisms: the error handler and the `doTry` / `doCatch` / `doFinally` block.

Error handlers apply to a route or to the whole context and decide what happens when a processor throws:

- `defaultErrorHandler` logs the failure and returns the exchange to the caller with the exception set (for `InOut`) or marks it failed (for `InOnly`).
- `deadLetterChannel("endpoint")` sends failed exchanges to a dead letter endpoint after retries.
- `noErrorHandler` disables error handling for a route, typically when a parent route or caller owns it.
- `TransactionErrorHandler` rolls back transactional work.

Common knobs:

```java
errorHandler(deadLetterChannel("jms:queue:orders.DLQ")
    .maximumRedeliveries(3)
    .redeliveryDelay(1000)
    .useExponentialBackOff()
    .backOffMultiplier(2)
    .useOriginalMessage()
    .handled(true));
```

- `maximumRedeliveries`, `redeliveryDelay`, and backoff control retries.
- `handled(true)` stops propagation and marks the exchange handled.
- `continued(true)` marks the error as handled but continues routing.
- `useOriginalMessage()` restores the message as it looked at the route input.
- `onRedelivery` lets you change the exchange before each retry.
- `retryWhile` and `asyncDelayedRedelivery` cover more advanced retry behavior.

`onException` targets specific exception types:

```java
onException(TimeoutException.class)
    .maximumRedeliveries(2)
    .redeliveryDelay(500)
    .handled(true)
    .to("log:timeout?level=WARN");
```

Scope matters: `onException` declared inside `RouteBuilder.configure()` applies to that builder's routes; declarations in a `RouteConfiguration` can be shared; context-level configuration applies globally.

Use `doTry` / `doCatch` / `doFinally` when error handling must be local to a section of the route and must not be intercepted by the global error handler:

```java
from("direct:start")
    .doTry()
        .to("http://partner/api")
    .doCatch(HttpException.class)
        .setBody(constant("fallback"))
        .to("mock:fallback")
    .doFinally()
        .to("mock:cleanup")
    .end();
```

Guidance:

- Do not mix `doTry` and the global error handler in ways that make retry semantics ambiguous.
- Make retries idempotent or deduplicate downstream.
- Use `useOriginalMessage` when a failed exchange must be replayed cleanly.
- Route exhausted retries to a dead letter queue and alert on its depth.
