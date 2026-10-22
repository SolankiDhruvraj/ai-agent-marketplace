package com.forgeflow.api;

import com.forgeflow.api.model.AgentRunDocument;
import com.forgeflow.api.service.ReactiveLlmClient;
import com.forgeflow.api.service.ReactiveStreamService;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

/**
 * Spring WebFlux Reactive Controller:
 * Provides non-blocking SSE streaming endpoints for real-time dashboard updates
 * and reactive completions.
 */
@RestController
@RequestMapping("/api/stream")
public class ReactiveStreamController {

    private final ReactiveStreamService reactiveStreamService;
    private final ReactiveLlmClient reactiveLlmClient;

    public ReactiveStreamController(ReactiveStreamService reactiveStreamService,
                                     ReactiveLlmClient reactiveLlmClient) {
        this.reactiveStreamService = reactiveStreamService;
        this.reactiveLlmClient = reactiveLlmClient;
    }

    /**
     * Real-time Server-Sent Events (SSE) stream of active runs for an organization.
     * React frontend listens to this stream to update run cards without polling.
     */
    @GetMapping(value = "/runs", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<AgentRunDocument>> streamRuns(
            @RequestHeader(value = "X-Org-Id", defaultValue = "demo-org") String orgId) {
        return reactiveStreamService.getOrgRunStream(orgId);
    }

    /**
     * Real-time execution log & step stream for a specific run.
     */
    @GetMapping(value = "/runs/{runId}/steps", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<ReactiveStreamService.RunStreamEvent>> streamSteps(
            @PathVariable String runId) {
        return reactiveStreamService.getRunStepStream(runId);
    }

    /**
     * Non-blocking reactive LLM chat test endpoint.
     */
    @PostMapping("/llm/chat")
    public Mono<Map<String, Object>> reactiveChat(@RequestBody Map<String, Object> req) {
        String prompt = req.getOrDefault("prompt", "Analyze repository").toString();
        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", "You are an AI engineering assistant."),
                Map.of("role", "user", "content", prompt)
        );

        return reactiveLlmClient.chatCompletionReactive(messages, 0.2)
                .map(content -> Map.of(
                        "success", true,
                        "reactiveResponse", content,
                        "streamEngine", "Spring WebFlux Reactor Netty"
                ));
    }
}
