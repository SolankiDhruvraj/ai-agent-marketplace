package com.forgeflow.api.service;

import com.forgeflow.api.model.AgentRunDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * High-performance Spring WebFlux Server-Sent Events (SSE) stream dispatcher.
 * Delivers non-blocking, zero-latency real-time agent run updates, AST progress,
 * and critic scores to frontend UI clients and remote worker listeners.
 */
@Service
public class ReactiveStreamService {

    private static final Logger log = LoggerFactory.getLogger(ReactiveStreamService.class);

    // Multicast sink for global live run updates
    private final Sinks.Many<AgentRunDocument> globalRunSink =
            Sinks.many().multicast().onBackpressureBuffer();

    // Org-specific multicast sinks for tenant isolation
    private final Map<String, Sinks.Many<AgentRunDocument>> orgSinks =
            new ConcurrentHashMap<>();

    // Run-specific log/progress sinks for live terminal streaming
    private final Map<String, Sinks.Many<RunStreamEvent>> runStepSinks =
            new ConcurrentHashMap<>();

    /**
     * Publishes an agent run update reactively.
     */
    public void publishRunUpdate(AgentRunDocument run) {
        if (run == null) return;
        globalRunSink.tryEmitNext(run);

        if (run.getOrganizationId() != null) {
            orgSinks.computeIfAbsent(run.getOrganizationId(),
                    id -> Sinks.many().multicast().onBackpressureBuffer())
                    .tryEmitNext(run);
        }
    }

    /**
     * Publishes a granular execution step (AST slicing, Critic score, Tool call) for a specific run.
     */
    public void publishStepEvent(String runId, String step, String workerId, String details) {
        RunStreamEvent event = new RunStreamEvent(
                runId,
                step,
                workerId,
                details,
                System.currentTimeMillis()
        );
        runStepSinks.computeIfAbsent(runId,
                id -> Sinks.many().multicast().onBackpressureBuffer())
                .tryEmitNext(event);
    }

    /**
     * Reactive stream of runs for an organization with periodic heartbeat.
     */
    public Flux<ServerSentEvent<AgentRunDocument>> getOrgRunStream(String orgId) {
        Sinks.Many<AgentRunDocument> sink = orgSinks.computeIfAbsent(orgId,
                id -> Sinks.many().multicast().onBackpressureBuffer());

        Flux<ServerSentEvent<AgentRunDocument>> updates = sink.asFlux()
                .map(run -> ServerSentEvent.<AgentRunDocument>builder()
                        .event("run-update")
                        .id(run.getId())
                        .data(run)
                        .build());

        Flux<ServerSentEvent<AgentRunDocument>> heartbeats = Flux.interval(Duration.ofSeconds(15))
                .map(seq -> ServerSentEvent.<AgentRunDocument>builder()
                        .event("ping")
                        .comment("keep-alive")
                        .build());

        return Flux.merge(updates, heartbeats);
    }

    /**
     * Reactive live stream of execution steps for a specific run (terminal trace).
     */
    public Flux<ServerSentEvent<RunStreamEvent>> getRunStepStream(String runId) {
        Sinks.Many<RunStreamEvent> sink = runStepSinks.computeIfAbsent(runId,
                id -> Sinks.many().multicast().onBackpressureBuffer());

        Flux<ServerSentEvent<RunStreamEvent>> events = sink.asFlux()
                .map(ev -> ServerSentEvent.<RunStreamEvent>builder()
                        .event("step")
                        .data(ev)
                        .build());

        Flux<ServerSentEvent<RunStreamEvent>> heartbeats = Flux.interval(Duration.ofSeconds(10))
                .map(seq -> ServerSentEvent.<RunStreamEvent>builder()
                        .event("ping")
                        .comment("keep-alive")
                        .build());

        return Flux.merge(events, heartbeats);
    }

    public record RunStreamEvent(
            String runId,
            String step,
            String workerId,
            String details,
            long timestamp
    ) {}
}
