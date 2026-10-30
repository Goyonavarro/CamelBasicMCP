---
name: testing-and-tooling
title: Testing and Tooling
description: Unit and route testing with camel-test-junit5, MockEndpoint, adviceWith, NotifyBuilder, plus JBang and debug tooling.
labels: core,testing,tooling
source: https://camel.apache.org/components/4.23.x/others/test-junit5.html
---

Camel tests usually assert route behavior, not implementation details. Keep routes small, give them route IDs, and use mock endpoints at the boundaries.

JUnit 5 route test:

```java
@CamelSpringBootTest
class OrderRouteTest {

    @Autowired ProducerTemplate template;
    @Autowired CamelContext context;

    @EndpointInject("mock:kafka:orders")
    MockEndpoint orders;

    @Test
    void sendsValidatedOrder() throws Exception {
        orders.expectedMessageCount(1);
        orders.expectedHeaderReceived("orderId", "A-1");

        template.sendBody("direct:orders", new Order("A-1"));

        orders.assertIsSatisfied();
    }
}
```

For plain Camel (without Spring Boot), extend `CamelTestSupport` from `camel-test-junit5` and override `createRouteBuilder()` or load routes in `@BeforeEach`.

Useful tools:

- `MockEndpoint` asserts message counts, bodies, headers, and order.
- `@MockEndpoints("kafka:*")` replaces real endpoints with mocks.
- `AdviceWith` rewires a route before the test starts, replacing external calls with mocks.
- `NotifyBuilder` waits for route milestones instead of sleeping.
- `ProducerTemplate` sends test messages and requests replies.
- `TestPropertyValues` or property placeholders provide test configuration.

```java
context.getRouteDefinition("orders").adviceWith(context, new AdviceWithRouteBuilder() {
    @Override
    public void configure() {
        weaveByToUri("kafka:*").replace().to("mock:kafka");
    }
});
```

JBang and CLI tooling:

- `jbang camel@apache/camel run route.yaml` runs a route without a project.
- `camel` CLI provides route inspection, debugging, and dependency resolution.
- Route coverage can show which route branches tests exercised.
- Camel JBang MCP exposes catalog and runtime tools to AI assistants; this local MCP complements it with focused, offline catalog docs.

Testing guidance:

- Mock at the system boundary, not at every processor.
- Assert business outcomes (headers, body shape, destination) rather than internal step order.
- Test error paths explicitly: dead letter routing, retries, and `handled` behavior.
- Keep tests deterministic; avoid real brokers and external HTTP unless they are the subject under test.
