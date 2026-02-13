package com.mcadmin.dataapi;

import com.sun.net.httpserver.HttpServer;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.logging.Level;

public class MCAdminDataAPI extends JavaPlugin {
    
    private HttpServer httpServer;
    private String apiKey;
    private int port;
    private boolean enabled;
    private boolean logRequests;

    @Override
    public void onEnable() {
        // Save default config if not exists
        saveDefaultConfig();
        
        // Load configuration
        loadConfiguration();
        
        if (!enabled) {
            getLogger().info("API is disabled in config, plugin will not start");
            return;
        }
        
        // Start HTTP server
        try {
            startHttpServer();
            getLogger().info("MCAdmin-DataAPI enabled on port " + port);
        } catch (IOException e) {
            getLogger().log(Level.SEVERE, "Failed to start HTTP server", e);
            getServer().getPluginManager().disablePlugin(this);
        }
    }

    @Override
    public void onDisable() {
        if (httpServer != null) {
            httpServer.stop(0);
            getLogger().info("HTTP server stopped");
        }
    }

    private void loadConfiguration() {
        reloadConfig();
        port = getConfig().getInt("port", 8080);
        apiKey = getConfig().getString("api-key", "mcadmin-default-key-change-me");
        enabled = getConfig().getBoolean("enabled", true);
        logRequests = getConfig().getBoolean("log-requests", false);
        
        if (apiKey.equals("mcadmin-default-key-change-me")) {
            getLogger().warning("WARNING: Using default API key! Change it in config.yml");
        }
    }

    private void startHttpServer() throws IOException {
        httpServer = HttpServer.create(new InetSocketAddress(port), 0);
        
        // Register API endpoints
        PlayerDataHandler playerDataHandler = new PlayerDataHandler(this);
        httpServer.createContext("/api/players", playerDataHandler);
        httpServer.createContext("/api/health", exchange -> {
            String response = "{\"status\":\"ok\",\"plugin\":\"MCAdmin-DataAPI\",\"version\":\"1.0.0\"}";
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.getBytes().length);
            exchange.getResponseBody().write(response.getBytes());
            exchange.getResponseBody().close();
        });
        
        httpServer.setExecutor(null); // Creates a default executor
        httpServer.start();
    }

    public String getApiKey() {
        return apiKey;
    }

    public boolean shouldLogRequests() {
        return logRequests;
    }
}
