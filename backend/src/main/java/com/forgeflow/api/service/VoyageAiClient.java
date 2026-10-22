package com.forgeflow.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Voyage AI Embedding Client.
 * Connects to Voyage AI's specialized embedding models:
 * - voyage-code-3 (State of the art for source code & technical RAG)
 * - voyage-3-lite (Fast & economical)
 */
@Service
public class VoyageAiClient {

    private static final Logger log = LoggerFactory.getLogger(VoyageAiClient.class);

    @Value("${voyage.api-url:${VOYAGE_API_URL:https://ai.mongodb.com/v1/embeddings}}")
    private String voyageApiUrl;

    @Value("${voyage.api-key:${VOYAGE_API_KEY:}}")
    private String apiKey;

    @Value("${voyage.model:${VOYAGE_MODEL:voyage-code-3}}")
    private String model;

    private final RestClient restClient;

    public VoyageAiClient() {
        this.restClient = RestClient.builder().build();
    }

    /**
     * Embeds a list of text/code chunks using Voyage AI.
     * Returns 1024-dimensional dense vectors.
     */
    public List<List<Double>> embed(List<String> inputs, String inputType) {
        if (apiKey != null && !apiKey.isBlank()) {
            try {
                Map<String, Object> body = Map.of(
                        "input", inputs,
                        "model", model,
                        "input_type", inputType != null ? inputType : "document"
                );

                var response = restClient.post()
                        .uri(voyageApiUrl)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey.trim())
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(Map.class);

                if (response != null && response.containsKey("data")) {
                    List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
                    List<List<Double>> results = new ArrayList<>();
                    for (var item : data) {
                        List<Double> embedding = (List<Double>) item.get("embedding");
                        results.add(embedding);
                    }
                    return results;
                }
            } catch (Exception e) {
                log.warn("Voyage AI API call failed, falling back to local dense vector simulator: {}", e.getMessage());
            }
        }

        // Deterministic high-dimensional vector fallback for testing without API key
        List<List<Double>> fallbackVectors = new ArrayList<>();
        for (String input : inputs) {
            fallbackVectors.add(generateDenseCodeVector(input, 1024));
        }
        return fallbackVectors;
    }

    public List<Double> embedSingle(String input, String inputType) {
        return embed(List.of(input), inputType).get(0);
    }

    /**
     * Generates a 1024-dimensional dense vector preserving code token frequencies and hash distribution
     */
    public List<Double> generateDenseCodeVector(String text, int dims) {
        List<Double> vec = new ArrayList<>(dims);
        for (int i = 0; i < dims; i++) vec.add(0.0);
        if (text == null || text.isBlank()) return vec;

        String[] tokens = text.toLowerCase().split("[^a-zA-Z0-9_]+");
        for (String token : tokens) {
            if (token.isEmpty()) continue;
            int hash1 = Math.abs(token.hashCode()) % dims;
            int hash2 = Math.abs((token + "_salt").hashCode()) % dims;
            vec.set(hash1, vec.get(hash1) + 1.2);
            vec.set(hash2, vec.get(hash2) + 0.8);
        }

        // L2 Normalization
        double norm = 0.0;
        for (double d : vec) norm += d * d;
        norm = Math.sqrt(norm);
        if (norm > 0) {
            for (int i = 0; i < dims; i++) {
                vec.set(i, vec.get(i) / norm);
            }
        }
        return vec;
    }

    public String getModel() {
        return model;
    }
}
