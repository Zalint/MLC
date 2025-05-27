# Simple PowerShell test for subscription system
Write-Host "🧪 Testing Subscription System" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green

# Test 1: Login
Write-Host "`n🔐 Testing login..." -ForegroundColor Yellow
$loginBody = @{
    username = "admin"
    password = "Admin123!"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.success -and $loginResponse.token) {
        Write-Host "✅ Login successful" -ForegroundColor Green
        $token = $loginResponse.token
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
    } else {
        Write-Host "❌ Login failed - no token received" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Create subscription
Write-Host "`n📝 Testing subscription creation..." -ForegroundColor Yellow
$subscriptionBody = @{
    client_name = "Jean Dupont Test"
    phone_number = "0123456789"
    total_deliveries = 10
    expiry_months = 6
} | ConvertTo-Json

try {
    $subscriptionResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/subscriptions" -Method POST -Body $subscriptionBody -Headers $headers
    
    if ($subscriptionResponse.success -and $subscriptionResponse.subscription) {
        Write-Host "✅ Subscription created successfully" -ForegroundColor Green
        Write-Host "   Card Number: $($subscriptionResponse.subscription.card_number)" -ForegroundColor Cyan
        Write-Host "   Client: $($subscriptionResponse.subscription.client_name)" -ForegroundColor Cyan
        Write-Host "   Deliveries: $($subscriptionResponse.subscription.remaining_deliveries)/$($subscriptionResponse.subscription.total_deliveries)" -ForegroundColor Cyan
        $cardNumber = $subscriptionResponse.subscription.card_number
    } else {
        Write-Host "❌ Subscription creation failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Subscription creation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: List subscriptions
Write-Host "`n📋 Testing subscription listing..." -ForegroundColor Yellow
try {
    $listResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/subscriptions" -Method GET -Headers $headers
    
    if ($listResponse.success -and $listResponse.subscriptions) {
        Write-Host "✅ Retrieved $($listResponse.subscriptions.Count) subscriptions" -ForegroundColor Green
        if ($listResponse.stats) {
            Write-Host "   Total cards: $($listResponse.stats.total_cards)" -ForegroundColor Cyan
            Write-Host "   Active cards: $($listResponse.stats.active_cards)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ Failed to retrieve subscriptions" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to retrieve subscriptions: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Check card validity
Write-Host "`n✅ Testing card validity check..." -ForegroundColor Yellow
try {
    $validityResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/subscriptions/check/$cardNumber" -Method GET -Headers $headers
    
    if ($validityResponse.success) {
        Write-Host "✅ Card $cardNumber validity check:" -ForegroundColor Green
        Write-Host "   Valid: $($validityResponse.valid)" -ForegroundColor Cyan
        Write-Host "   Status: $($validityResponse.status)" -ForegroundColor Cyan
        if ($validityResponse.subscription) {
            Write-Host "   Remaining deliveries: $($validityResponse.subscription.remaining_deliveries)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ Card validity check failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Card validity check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Create MLC order with subscription
Write-Host "`n🚚 Testing MLC order with automatic subscription deduction..." -ForegroundColor Yellow
$orderBody = @{
    client_name = "Jean Dupont Test"
    phone_number = "0123456789"
    address = "123 Rue de Test"
    description = "Commande de test MLC"
    course_price = 1500
} | ConvertTo-Json

try {
    $orderResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/subscriptions/mlc-order" -Method POST -Body $orderBody -Headers $headers
    
    if ($orderResponse.success -and $orderResponse.order) {
        Write-Host "✅ MLC order created successfully" -ForegroundColor Green
        Write-Host "   Order ID: $($orderResponse.order.id)" -ForegroundColor Cyan
        Write-Host "   Subscription used: $($orderResponse.subscription_used)" -ForegroundColor Cyan
        
        if ($orderResponse.subscription_used -and $orderResponse.subscription) {
            Write-Host "   Remaining deliveries: $($orderResponse.subscription.remaining_deliveries)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ MLC order creation failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ MLC order creation failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Get subscription statistics
Write-Host "`n📊 Testing subscription statistics..." -ForegroundColor Yellow
try {
    $statsResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/v1/subscriptions/stats" -Method GET -Headers $headers
    
    if ($statsResponse.success -and $statsResponse.stats) {
        Write-Host "✅ Subscription statistics:" -ForegroundColor Green
        Write-Host "   Total cards: $($statsResponse.stats.total_cards)" -ForegroundColor Cyan
        Write-Host "   Active cards: $($statsResponse.stats.active_cards)" -ForegroundColor Cyan
        Write-Host "   Completed cards: $($statsResponse.stats.completed_cards)" -ForegroundColor Cyan
        Write-Host "   Expired cards: $($statsResponse.stats.expired_cards)" -ForegroundColor Cyan
        Write-Host "   Total deliveries sold: $($statsResponse.stats.total_deliveries_sold)" -ForegroundColor Cyan
        Write-Host "   Total deliveries used: $($statsResponse.stats.total_deliveries_used)" -ForegroundColor Cyan
        Write-Host "   Expiring soon: $($statsResponse.expiring_count)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Failed to retrieve statistics" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to retrieve statistics: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 All tests completed!" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green 