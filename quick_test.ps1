Write-Host "Testing Subscription System" -ForegroundColor Green

# Login
$loginBody = @{username="admin"; password="Admin123!"} | ConvertTo-Json
$loginResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
Write-Host "Login: $($loginResponse.message)" -ForegroundColor Green

# Set headers
$headers = @{"Authorization" = "Bearer $($loginResponse.token)"; "Content-Type" = "application/json"}

# Create subscription
$subscriptionBody = @{
    client_name = "Jean Dupont Test"
    phone_number = "0123456789"
    total_deliveries = 10
    expiry_months = 6
} | ConvertTo-Json

try {
    $subscriptionResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/subscriptions" -Method POST -Body $subscriptionBody -Headers $headers
    Write-Host "Subscription created: $($subscriptionResponse.subscription.card_number)" -ForegroundColor Green
    $cardNumber = $subscriptionResponse.subscription.card_number
} catch {
    Write-Host "Subscription error: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Test MLC order
$orderBody = @{
    client_name = "Jean Dupont Test"
    phone_number = "0123456789"
    address = "123 Rue Test"
    description = "Test MLC order"
    course_price = 1500
} | ConvertTo-Json

try {
    $orderResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/subscriptions/mlc-order" -Method POST -Body $orderBody -Headers $headers
    Write-Host "MLC Order created: $($orderResponse.order.id)" -ForegroundColor Green
    Write-Host "Subscription used: $($orderResponse.subscription_used)" -ForegroundColor Green
    if ($orderResponse.subscription) {
        Write-Host "Remaining deliveries: $($orderResponse.subscription.remaining_deliveries)" -ForegroundColor Green
    }
} catch {
    Write-Host "Order error: $($_.Exception.Message)" -ForegroundColor Red
}

# Get stats
try {
    $statsResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/subscriptions/stats" -Method GET -Headers $headers
    Write-Host "Total cards: $($statsResponse.stats.total_cards)" -ForegroundColor Green
    Write-Host "Active cards: $($statsResponse.stats.active_cards)" -ForegroundColor Green
} catch {
    Write-Host "Stats error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test completed!" -ForegroundColor Green 