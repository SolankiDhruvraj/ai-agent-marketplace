package com.forgeflow.api;

import com.forgeflow.api.model.UserAccountDocument;
import com.forgeflow.api.repository.UserAccountRepository;
import com.forgeflow.api.service.BudgetService;
import com.forgeflow.api.service.JwtTokenService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserAccountRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final BudgetService budgetService;

    public AuthController(UserAccountRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtTokenService jwtTokenService,
                          BudgetService budgetService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.budgetService = budgetService;
    }

    /**
     * User Registration with BCrypt Password Hashing & Initial Organization Budget Allocation
     */
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody AuthRequest request) {
        if (request.username == null || request.username.trim().length() < 3) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username must be at least 3 characters."));
        }
        if (request.password == null || request.password.trim().length() < 6) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters."));
        }

        String username = request.username.trim().toLowerCase();
        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Username '" + username + "' is already registered. Please log in."));
        }

        String orgId = (request.orgId != null && !request.orgId.isBlank())
                ? request.orgId.trim()
                : username + "-org";

        // BCrypt salted hash
        String hash = passwordEncoder.encode(request.password);
        UserAccountDocument user = new UserAccountDocument(username, hash, orgId, "ROLE_USER");
        userRepository.save(user);

        // Seed initial balance in billing ledger for this new workspace
        budgetService.seedInitialCredit(orgId);

        String token = jwtTokenService.generateToken(username, orgId, "ROLE_USER");
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "token", token,
                "username", username,
                "orgId", orgId,
                "tokenType", "Bearer",
                "message", "Account successfully created!"
        ));
    }

    /**
     * User Login with BCrypt Password Verification
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        if (request.username == null || request.username.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required."));
        }
        if (request.password == null || request.password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password is required."));
        }

        String username = request.username.trim().toLowerCase();
        var userOpt = userRepository.findByUsername(username);

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials: user does not exist. Please sign up first."));
        }

        UserAccountDocument user = userOpt.get();
        if (!passwordEncoder.matches(request.password, user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials: incorrect password."));
        }

        String token = jwtTokenService.generateToken(user.getUsername(), user.getOrganizationId(), user.getRole());
        return ResponseEntity.ok(Map.of(
                "token", token,
                "username", user.getUsername(),
                "orgId", user.getOrganizationId(),
                "tokenType", "Bearer"
        ));
    }

    public record AuthRequest(@NotBlank String username, String password, String orgId) {}
}
