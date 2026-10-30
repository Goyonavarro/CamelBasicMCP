---
name: dsl-overview
title: Route DSL Overview
description: Java, YAML, XML, and endpoint DSLs, when to use each, and how the same route looks in different forms.
labels: core,dsl
source: https://camel.apache.org/manual/dsl.html
---

Camel routes can be written in several DSLs. The runtime model is the same; only the syntax differs.

Java DSL:

```java
from("direct:orders")
    .routeId("orders")
    .choice()
        .when(header("type").isEqualTo("priority"))
            .to("seda:priority")
        .otherwise()
            .to("seda:standard")
    .end();
```

YAML DSL:

```yaml
- route:
    id: orders
    from:
      uri: direct:orders
      steps:
        - choice:
            when:
              - simple: "${header.type} == 'priority'"
                steps:
                  - to: seda:priority
            otherwise:
              steps:
                - to: seda:standard
```

XML DSL:

```xml
<route id="orders">
  <from uri="direct:orders"/>
  <choice>
    <when>
      <simple>${header.type} == 'priority'</simple>
      <to uri="seda:priority"/>
    </when>
    <otherwise>
      <to uri="seda:standard"/>
    </otherwise>
  </choice>
</route>
```

Guidance:

- Java DSL is the most expressive and type-safe, and is the default for IG route builders.
- YAML DSL is concise and works well for configuration-driven routes and Camel JBang.
- XML DSL is common in legacy Spring integrations and some IG configurations.
- The endpoint DSL (`kafka("topic").brokers("...")`) is a type-safe Java alternative to string URIs.
- Route templates and Kamelets package reusable route logic with parameters.

Keep DSL choices consistent within a codebase. Mixing Java and XML routes in one application is supported but complicates ownership, testing, and configuration.

Regardless of DSL, the same catalog applies: component URIs, endpoint options, EIP properties, and expression languages behave identically.
