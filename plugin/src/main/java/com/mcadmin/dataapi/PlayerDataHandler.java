package com.mcadmin.dataapi;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PlayerDataHandler implements HttpHandler {
    
    private final MCAdminDataAPI plugin;
    private final Gson gson;

    public PlayerDataHandler(MCAdminDataAPI plugin) {
        this.plugin = plugin;
        this.gson = new GsonBuilder().setPrettyPrinting().create();
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        // CORS headers
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
        
        // Handle OPTIONS request for CORS preflight
        if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        // Only allow GET requests
        if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
            sendResponse(exchange, 405, createErrorResponse("Method not allowed"));
            return;
        }

        // Check API key
        String providedKey = exchange.getRequestHeaders().getFirst("X-API-Key");
        if (providedKey == null || !providedKey.equals(plugin.getApiKey())) {
            sendResponse(exchange, 401, createErrorResponse("Unauthorized: Invalid or missing API key"));
            return;
        }

        if (plugin.shouldLogRequests()) {
            plugin.getLogger().info("API request from " + exchange.getRemoteAddress());
        }

        // Collect player data (must be done on main thread)
        try {
            List<Map<String, Object>> playerDataList = new ArrayList<>();
            
            // Schedule sync task to collect player data
            Bukkit.getScheduler().runTask(plugin, () -> {
                for (Player player : Bukkit.getOnlinePlayers()) {
                    playerDataList.add(collectPlayerData(player));
                }
            });
            
            // Wait a moment for data collection
            Thread.sleep(50);
            
            Map<String, Object> response = new HashMap<>();
            response.put("players", playerDataList);
            response.put("count", playerDataList.size());
            response.put("timestamp", System.currentTimeMillis());
            response.put("server", Bukkit.getServer().getName());
            
            String jsonResponse = gson.toJson(response);
            sendResponse(exchange, 200, jsonResponse);
            
        } catch (Exception e) {
            plugin.getLogger().severe("Error collecting player data: " + e.getMessage());
            e.printStackTrace();
            sendResponse(exchange, 500, createErrorResponse("Internal server error"));
        }
    }

    private Map<String, Object> collectPlayerData(Player player) {
        Map<String, Object> data = new HashMap<>();
        
        try {
            // Basic info
            data.put("uuid", player.getUniqueId().toString());
            data.put("name", player.getName());
            data.put("displayName", player.getDisplayName());
            
            // Location
            Map<String, Object> location = new HashMap<>();
            location.put("x", Math.round(player.getLocation().getX() * 100.0) / 100.0);
            location.put("y", Math.round(player.getLocation().getY() * 100.0) / 100.0);
            location.put("z", Math.round(player.getLocation().getZ() * 100.0) / 100.0);
            location.put("world", player.getWorld().getName());
            location.put("pitch", Math.round(player.getLocation().getPitch() * 10.0) / 10.0);
            location.put("yaw", Math.round(player.getLocation().getYaw() * 10.0) / 10.0);
            data.put("location", location);
            
            // Health and status
            data.put("health", Math.round(player.getHealth() * 10.0) / 10.0);
            data.put("maxHealth", player.getMaxHealth());
            data.put("foodLevel", player.getFoodLevel());
            data.put("saturation", Math.round(player.getSaturation() * 10.0) / 10.0);
            data.put("level", player.getLevel());
            data.put("exp", Math.round(player.getExp() * 100.0) / 100.0);
            data.put("totalExperience", player.getTotalExperience());
            
            // Game state
            data.put("gameMode", player.getGameMode().name());
            data.put("isFlying", player.isFlying());
            data.put("allowFlight", player.getAllowFlight());
            data.put("walkSpeed", player.getWalkSpeed());
            data.put("flySpeed", player.getFlySpeed());
            
            // Status effects
            data.put("fireTicks", player.getFireTicks());
            data.put("remainingAir", player.getRemainingAir());
            data.put("maximumAir", player.getMaximumAir());
            
            // Inventory
            List<Map<String, Object>> inventory = new ArrayList<>();
            for (int i = 0; i < player.getInventory().getSize(); i++) {
                var item = player.getInventory().getItem(i);
                if (item != null && !item.getType().isAir()) {
                    Map<String, Object> itemData = new HashMap<>();
                    itemData.put("slot", i);
                    itemData.put("type", item.getType().name());
                    itemData.put("amount", item.getAmount());
                    itemData.put("durability", item.getDurability());
                    if (item.hasItemMeta() && item.getItemMeta().hasDisplayName()) {
                        itemData.put("displayName", item.getItemMeta().getDisplayName());
                    }
                    if (item.getEnchantments().size() > 0) {
                        List<String> enchants = new ArrayList<>();
                        item.getEnchantments().forEach((ench, level) -> 
                            enchants.add(ench.getKey().getKey() + ":" + level)
                        );
                        itemData.put("enchantments", enchants);
                    }
                    inventory.add(itemData);
                }
            }
            data.put("inventory", inventory);
            
            // Statistics (sample - can be extended)
            Map<String, Object> statistics = new HashMap<>();
            try {
                statistics.put("playTime", player.getStatistic(org.bukkit.Statistic.PLAY_ONE_MINUTE));
                statistics.put("deaths", player.getStatistic(org.bukkit.Statistic.DEATHS));
                statistics.put("mobKills", player.getStatistic(org.bukkit.Statistic.MOB_KILLS));
                statistics.put("playerKills", player.getStatistic(org.bukkit.Statistic.PLAYER_KILLS));
                statistics.put("jumps", player.getStatistic(org.bukkit.Statistic.JUMP));
                statistics.put("distanceWalked", player.getStatistic(org.bukkit.Statistic.WALK_ONE_CM));
                statistics.put("distanceFlown", player.getStatistic(org.bukkit.Statistic.FLY_ONE_CM));
            } catch (Exception e) {
                // Some statistics might not be available
            }
            data.put("statistics", statistics);
            
            // Achievements/Advancements (count)
            int advancementCount = 0;
            List<String> completedAdvancements = new ArrayList<>();
            try {
                java.util.Iterator<org.bukkit.advancement.Advancement> advIterator = Bukkit.getServer().advancementIterator();
                while (advIterator.hasNext()) {
                    org.bukkit.advancement.Advancement advancement = advIterator.next();
                    if (player.getAdvancementProgress(advancement).isDone()) {
                        advancementCount++;
                        completedAdvancements.add(advancement.getKey().getKey());
                    }
                }
            } catch (Exception e) {
                // Advancement API might have issues
            }
            data.put("advancementCount", advancementCount);
            data.put("achievements", completedAdvancements.size() > 50 
                ? completedAdvancements.subList(0, 50) // Limit to first 50
                : completedAdvancements);
            
            // Connection info
            data.put("ping", player.getPing());
            data.put("address", player.getAddress() != null ? player.getAddress().getAddress().getHostAddress() : "unknown");
            
        } catch (Exception e) {
            plugin.getLogger().warning("Error collecting data for player " + player.getName() + ": " + e.getMessage());
            data.put("error", "Partial data collection failed");
        }
        
        return data;
    }

    private String createErrorResponse(String message) {
        Map<String, String> error = new HashMap<>();
        error.put("error", message);
        return gson.toJson(error);
    }

    private void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
