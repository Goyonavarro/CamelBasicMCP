---
name: routes-and-endpoints
title: Routes and Endpoints
description: How a Camel route wires a consumer endpoint to processors and producer endpoints, and how routes are identified and controlled.
labels: core,routing
source: https://camel.apache.org/manual/routes.html
---

A route is the basic unit of integration in Camel. It is a pipeline that starts at a consumer endpoint, processes an exchange through zero or more steps, and sends it to one or more producer endpoints.

```java
public class OrderRoute extends RouteBuilder {
    @Override
    public void configure() {
        from("direct:orders")
            .routeId("order-ingest")
            .log("Received ${header.orderId}")
            .to("bean:orderService?method=validate")
            .to("kafka:orders?brokers={{kafka.brokers}}");
    }
}
```

Key ideas:

- `from(uri)` declares the consumer endpoint. It starts the route and creates exchanges.
- Each `to(uri)` is a producer endpoint. Camel resolves the URI prefix (the scheme) to a `Component`, which creates the `Endpoint`.
- Processors and EIPs sit between endpoints. They can transform the body, set headers, route conditionally, split, aggregate, or call beans.
- `routeId(...)` gives the route a stable name used by logs, JMX, metrics, error handlers, and tests. Without it, Camel generates an ID.
- Routes are added to a `CamelContext`. The context owns components, endpoints, routes, type converters, registries, and lifecycle.
- A context can contain many routes; they communicate through `direct:`, `seda:`, `vm:`, or external brokers.

Endpoint URIs use the form `scheme:context-path?option=value&option2=value`. For example `file:inbox?noop=true&delay=5000` selects the `file` component, path `inbox`, with two endpoint options.

Route lifecycle options include `autoStartup`, `startupOrder`, `shutdownRoute`, and `shutdownRunningTask`. They matter when routes depend on each other at startup or shutdown.

Route templates and route configuration let you define a parameterized route once and instantiate it with different inputs and outputs. This is useful for multi-tenant or repeated integration shapes.

RouteBuilder is the Java entry point. Camel also supports YAML, XML, and annotation-based route definitions. See the `yaml-dsl` guide and the `dsl-overview` concept for alternatives.

For IG projects, routes usually extend `GwRouteBuilder` or `RouteBuilder`, use `direct:` for in-app hand-offs, and use `gw-integration:` endpoints for Guidewire-managed integration points.
