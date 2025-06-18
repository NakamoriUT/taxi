let map;
let depot = null;
let deliveries = [];
let vehicles = [];
let deliveryCounter = 0;
let vehicleCounter = 0;
let markers = [];
let routes = [];
let mapClickMode = null;
let tempMarker = null;
let vehicleMarkers = [];
let animationIntervals = [];
let routeAnimations = [];
let followingVehicle = null;
let userInteracting = false;
let animationSpeed = 150; // デフォルト速度（より遅く）
let animationCompleted = false;

document.addEventListener('DOMContentLoaded', function() {
    map = L.map('map').setView([35.6762, 139.6503], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // 地図クリックイベントを追加
    map.on('click', function(e) {
        if (mapClickMode) {
            handleMapClick(e.latlng);
        }
    });
    
    // ユーザーが地図を操作している間は追従を一時停止
    map.on('dragstart', function() {
        if (followingVehicle !== null) {
            userInteracting = true;
        }
    });
    
    map.on('dragend', function() {
        setTimeout(() => {
            userInteracting = false;
        }, 2000); // 2秒後に追従を再開
    });
    
    addDelivery();
    addVehicle();
});

async function geocodeDepot() {
    const address = document.getElementById('depot-address').value;
    if (!address) {
        alert('住所を入力してください');
        return;
    }
    
    try {
        const response = await fetch('/geocode', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({address: address})
        });
        
        const data = await response.json();
        if (data.success) {
            depot = {
                address: address,
                lat: data.lat,
                lon: data.lon
            };
            document.getElementById('depot-result').innerHTML = 
                `<small style="color: green;">✓ ${data.display_name}</small>`;
            updateMap();
        } else {
            alert('住所が見つかりませんでした: ' + data.error);
        }
    } catch (error) {
        alert('エラーが発生しました: ' + error);
    }
}

function addDelivery() {
    deliveryCounter++;
    const html = `
        <div class="delivery-item" id="delivery-${deliveryCounter}">
            <h3>配送先 ${deliveryCounter}</h3>
            <input type="text" id="delivery-address-${deliveryCounter}" placeholder="住所">
            <button onclick="geocodeDelivery(${deliveryCounter})">住所を確認</button>
            <button onclick="setDeliveryByMap(${deliveryCounter})">地図で選択</button>
            <div id="delivery-result-${deliveryCounter}"></div>
            
            <div class="form-row">
                <div>
                    <label>荷物量</label>
                    <input type="number" id="delivery-demand-${deliveryCounter}" placeholder="荷物量" value="1" onchange="validateDemand(${deliveryCounter})">
                    <div id="delivery-demand-warning-${deliveryCounter}" style="color: red; font-size: 12px; display: none;"></div>
                </div>
                <div>
                    <label>優先度 (1-10)</label>
                    <input type="number" id="delivery-priority-${deliveryCounter}" placeholder="優先度" value="5" min="1" max="10">
                </div>
            </div>
            
            <div class="form-row">
                <div>
                    <label>時間帯開始</label>
                    <select id="delivery-tw-start-${deliveryCounter}">
                        <option value="">指定なし</option>
                        ${generateTimeOptions()}
                    </select>
                </div>
                <div>
                    <label>時間帯終了</label>
                    <select id="delivery-tw-end-${deliveryCounter}">
                        <option value="">指定なし</option>
                        ${generateTimeOptions()}
                    </select>
                </div>
            </div>
            
            <div>
                <label>作業時間</label>
                <select id="delivery-service-${deliveryCounter}">
                    <option value="10">10分</option>
                    <option value="20">20分</option>
                    <option value="30">30分</option>
                    <option value="40">40分</option>
                    <option value="50">50分</option>
                    <option value="60">1時間</option>
                    <option value="90">1時間30分</option>
                    <option value="120">2時間</option>
                </select>
            </div>
            
            <button class="remove-btn" onclick="removeDelivery(${deliveryCounter})">削除</button>
        </div>
    `;
    document.getElementById('deliveries-list').insertAdjacentHTML('beforeend', html);
}

async function geocodeDelivery(id) {
    const address = document.getElementById(`delivery-address-${id}`).value;
    if (!address) {
        alert('住所を入力してください');
        return;
    }
    
    try {
        const response = await fetch('/geocode', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({address: address})
        });
        
        const data = await response.json();
        if (data.success) {
            const delivery = {
                id: id,
                address: address,
                lat: data.lat,
                lon: data.lon
            };
            
            const index = deliveries.findIndex(d => d.id === id);
            if (index >= 0) {
                deliveries[index] = delivery;
            } else {
                deliveries.push(delivery);
            }
            
            document.getElementById(`delivery-result-${id}`).innerHTML = 
                `<small style="color: green;">✓ ${data.display_name}</small>`;
            updateMap();
        } else {
            alert('住所が見つかりませんでした: ' + data.error);
        }
    } catch (error) {
        alert('エラーが発生しました: ' + error);
    }
}

function removeDelivery(id) {
    document.getElementById(`delivery-${id}`).remove();
    deliveries = deliveries.filter(d => d.id !== id);
    updateMap();
}

function addVehicle() {
    vehicleCounter++;
    const html = `
        <div class="vehicle-item" id="vehicle-${vehicleCounter}">
            <h3>車両 ${vehicleCounter}</h3>
            <div class="form-row">
                <div>
                    <label>車両名</label>
                    <input type="text" id="vehicle-name-${vehicleCounter}" placeholder="車両名" value="車両${vehicleCounter}">
                </div>
                <div>
                    <label>積載量</label>
                    <input type="number" id="vehicle-capacity-${vehicleCounter}" placeholder="積載量" value="100" onchange="validateAllDemands()">
                </div>
            </div>
            <button class="remove-btn" onclick="removeVehicle(${vehicleCounter})">削除</button>
        </div>
    `;
    document.getElementById('vehicles-list').insertAdjacentHTML('beforeend', html);
}

function removeVehicle(id) {
    if (document.querySelectorAll('.vehicle-item').length <= 1) {
        alert('最低1台の車両が必要です');
        return;
    }
    document.getElementById(`vehicle-${id}`).remove();
}

function updateMap() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    if (depot) {
        const depotMarker = L.marker([depot.lat, depot.lon], {
            icon: L.divIcon({
                html: '<div style="background-color: red; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
                iconSize: [20, 20],
                className: ''
            })
        }).addTo(map);
        depotMarker.bindPopup('出発地点');
        markers.push(depotMarker);
    }
    
    deliveries.forEach((delivery, index) => {
        // 分割配送が必要かチェック
        const vehicleElements = document.querySelectorAll('.vehicle-item');
        let maxCapacity = 0;
        vehicleElements.forEach(elem => {
            const id = elem.id.replace('vehicle-', '');
            const capacity = parseInt(document.getElementById(`vehicle-capacity-${id}`).value) || 0;
            maxCapacity = Math.max(maxCapacity, capacity);
        });
        
        const demand = parseInt(document.getElementById(`delivery-demand-${delivery.id}`).value) || 0;
        const needsSplit = demand > maxCapacity && maxCapacity > 0;
        const splitCount = needsSplit ? Math.ceil(demand / maxCapacity) : 1;
        
        const markerColor = needsSplit ? '#ff6b6b' : 'blue';
        const marker = L.marker([delivery.lat, delivery.lon], {
            icon: L.divIcon({
                html: `<div style="background-color: ${markerColor}; color: white; width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">${index + 1}</div>`,
                iconSize: [25, 25],
                className: ''
            })
        }).addTo(map);
        
        let popupText = `配送先 ${delivery.id}`;
        if (needsSplit) {
            popupText += `<br><span style="color: red;">分割配送: ${splitCount}回</span>`;
        }
        marker.bindPopup(popupText);
        markers.push(marker);
    });
    
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

async function optimizeRoute() {
    console.log('optimizeRoute called');
    console.log('depot:', depot);
    console.log('deliveries:', deliveries);
    
    if (!depot) {
        alert('出発地点を設定してください');
        return;
    }
    
    if (deliveries.length === 0) {
        alert('配送先を追加してください');
        return;
    }
    
    // 既存のアニメーションを停止してクリア
    stopAnimation();
    
    // 進捗バーを表示
    showProgress(0, 'データ準備中...');
    
    const vehicleElements = document.querySelectorAll('.vehicle-item');
    const vehiclesData = [];
    
    vehicleElements.forEach(elem => {
        const id = elem.id.replace('vehicle-', '');
        vehiclesData.push({
            name: document.getElementById(`vehicle-name-${id}`).value,
            capacity: parseInt(document.getElementById(`vehicle-capacity-${id}`).value) || 100
        });
    });
    
    const deliveriesData = deliveries.map(d => {
        const demand = parseInt(document.getElementById(`delivery-demand-${d.id}`).value) || 1;
        const priority = parseInt(document.getElementById(`delivery-priority-${d.id}`).value) || 5;
        const serviceTime = parseInt(document.getElementById(`delivery-service-${d.id}`).value) || 10;
        const twStart = document.getElementById(`delivery-tw-start-${d.id}`).value;
        const twEnd = document.getElementById(`delivery-tw-end-${d.id}`).value;
        
        const data = {
            ...d,
            demand: demand,
            priority: priority,
            service_time: serviceTime
        };
        
        if (twStart && twEnd) {
            data.time_window = [parseInt(twStart), parseInt(twEnd)];
        }
        
        return data;
    });
    
    console.log('vehiclesData:', vehiclesData);
    console.log('deliveriesData:', deliveriesData);
    
    // 最低道幅の設定を取得
    const minRoadWidth = parseFloat(document.getElementById('min-road-width').value) || 0;
    
    const requestData = {
        depot: depot,
        deliveries: deliveriesData,
        vehicles: vehiclesData,
        min_road_width: minRoadWidth
    };
    
    console.log('Sending request:', requestData);
    showProgress(20, 'サーバーに送信中...');
    
    try {
        const response = await fetch('/optimize', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestData)
        });
        
        showProgress(40, '最適化計算中...');
        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Result:', result);
        
        if (result.success) {
            // 分割配送の警告を表示
            if (result.split_deliveries && result.split_deliveries.length > 0) {
                let warningMsg = '以下の配送先は荷物量が車両容量を超えるため、複数回に分けて配送されます:\n\n';
                result.split_deliveries.forEach(sd => {
                    warningMsg += `• 配送先${sd.id} (${sd.address}): 荷物量${sd.demand} → ${sd.splits_needed}回に分割\n`;
                });
                warningMsg += '\n自動的に最適なルートが計算されます。';
                
                if (confirm(warningMsg + '\n\n続行しますか？')) {
                    // ハイライトをクリア
                    document.querySelectorAll('.delivery-item').forEach(elem => {
                        elem.style.border = '';
                        elem.style.backgroundColor = '';
                    });
                    document.querySelectorAll('[id^="delivery-demand-"]').forEach(elem => {
                        elem.style.border = '';
                        elem.style.backgroundColor = '';
                    });
                } else {
                    hideProgress();
                    return;
                }
            }
            
            showProgress(60, '道路に沿ったルートを計算中...');
            await displayRoutes(result.routes, vehiclesData);
            hideProgress();
            
            // 画面の一番上までスクロール
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // 未訪問の配送先がある場合は警告
            if (result.unvisited && result.unvisited > 0) {
                alert(`警告: ${result.unvisited}件の配送先が割り当てられませんでした。\n\n考えられる原因:\n- 車両の積載量が不足\n- 時間制約が厳しすぎる\n- 車両数が不足\n\n車両を追加するか、制約条件を見直してください。`);
            }
        } else {
            hideProgress();
            
            // エラータイプに応じた適切なメッセージを表示
            if (result.error_type === 'oversized_delivery') {
                // 容量超過エラーの詳細表示
                let errorMessage = result.error + '\n\n対処方法:\n';
                errorMessage += '1. より大きな積載量の車両を追加する\n';
                errorMessage += '2. 荷物を分割して複数回に分ける\n';
                errorMessage += '3. 該当する配送先の荷物量を減らす';
                
                alert(errorMessage);
                
                // 問題のある配送先をハイライト
                if (result.oversized_deliveries) {
                    result.oversized_deliveries.forEach(od => {
                        const deliveryElement = document.getElementById(`delivery-${od.id}`);
                        if (deliveryElement) {
                            deliveryElement.style.border = '2px solid red';
                            deliveryElement.style.backgroundColor = '#ffe6e6';
                            
                            // 荷物量フィールドにフォーカス
                            const demandInput = document.getElementById(`delivery-demand-${od.id}`);
                            if (demandInput) {
                                demandInput.style.border = '2px solid red';
                                demandInput.style.backgroundColor = '#ffe6e6';
                            }
                        }
                    });
                }
            } else {
                // その他のエラー
                alert('最適化に失敗しました: ' + (result.error || JSON.stringify(result)));
            }
        }
    } catch (error) {
        console.error('Error:', error);
        hideProgress();
        alert('エラーが発生しました: ' + error);
    }
}

async function displayRoutes(optimizedRoutes, vehiclesData) {
    // 既存のアニメーションを停止
    stopAnimation();
    
    // 既存のルートを削除
    routes.forEach(route => map.removeLayer(route));
    routes = [];
    
    // 既存のルートアニメーションデータをクリア
    routeAnimations = [];
    
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
    const routeResults = document.getElementById('route-results');
    routeResults.innerHTML = '<h2>最適化されたルート</h2>';
    
    // 総ルート数を計算
    let totalSegments = 0;
    optimizedRoutes.forEach(route => {
        totalSegments += route.route.length;
        if (route.route[route.route.length - 1] !== 0) totalSegments++;
    });
    let processedSegments = 0;
    
    for (let index = 0; index < optimizedRoutes.length; index++) {
        const route = optimizedRoutes[index];
        const color = colors[index % colors.length];
        const vehicle = vehiclesData[route.vehicle_id];
        
        let routeHtml = `<div class="route-info">
            <h3>${vehicle.name} のルート</h3>`;
        
        // 道幅制限の情報を表示
        if (route.road_width_notice) {
            routeHtml += `<div style="background-color: #e3f2fd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                <strong>🚚 ${route.road_width_notice}</strong>
            </div>`;
        }
        
        // reload_infoがある場合は分割配送情報を表示
        console.log('Route:', route);
        console.log('Route.route:', route.route);
        console.log('Route.reload_info:', route.reload_info);
        
        if (route.reload_info) {
            const splitDeliveries = {};
            route.reload_info.forEach(info => {
                if (info.split_info && info.index > 0) {
                    if (!splitDeliveries[info.index]) {
                        splitDeliveries[info.index] = 0;
                    }
                    splitDeliveries[info.index]++;
                }
            });
            
            if (Object.keys(splitDeliveries).length > 0) {
                routeHtml += `<div style="background-color: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 5px;">
                    <strong>🔄 分割配送あり:</strong><br>`;
                for (const [idx, count] of Object.entries(splitDeliveries)) {
                    const delivery = deliveries.find(d => deliveries.indexOf(d) === idx - 1);
                    if (delivery) {
                        routeHtml += `• 配送先${delivery.id}: ${count}回に分けて配送<br>`;
                    }
                }
                routeHtml += `</div>`;
            }
        }
        
        const locations = [depot];
        const routeCoordinates = [];
        
        // Build route and get coordinates
        for (let i = 0; i < route.route.length; i++) {
            const nodeIndex = route.route[i];
            
            if (nodeIndex === 0) {
                if (i > 0) {
                    // ルート途中でデポに戻る場合は補充と表示
                    const isLastStop = i === route.route.length - 1;
                    if (isLastStop) {
                        routeHtml += `<div class="route-stop">${i + 1}. 出発地点に戻る</div>`;
                    } else {
                        routeHtml += `<div class="route-stop" style="background-color: #fff3cd; padding: 5px; margin: 2px 0;">
                            ${i + 1}. 🔄 出発地点で補充
                        </div>`;
                    }
                } else {
                    routeHtml += `<div class="route-stop">1. 出発地点から開始</div>`;
                }
            } else {
                const delivery = deliveries.find(d => deliveries.indexOf(d) === nodeIndex - 1);
                locations.push(delivery);
                
                // reload_infoから詳細情報を取得
                let splitInfo = '';
                let demandInfo = '';
                if (route.reload_info) {
                    // ルート内の現在位置までの要素を確認
                    let reloadInfoIndex = 0;
                    for (let j = 0; j <= i; j++) {
                        if (route.route[j] === 0 && j > 0) {
                            // デポへの帰還はreload_infoのインデックスを進める
                            reloadInfoIndex++;
                        } else if (route.route[j] > 0) {
                            // 配送先の場合
                            if (j === i && reloadInfoIndex < route.reload_info.length) {
                                const info = route.reload_info[reloadInfoIndex];
                                if (info && info.index === nodeIndex) {
                                    if (info.split_info) {
                                        splitInfo = ` <span style="color: #e74c3c; font-size: 12px;">${info.split_info}</span>`;
                                    }
                                    if (info.demand) {
                                        demandInfo = ` (荷物量: ${info.demand})`;
                                    }
                                }
                            }
                            reloadInfoIndex++;
                        }
                    }
                }
                
                routeHtml += `<div class="route-stop">${i + 1}. 配送先${delivery.id}: ${delivery.address}${demandInfo}${splitInfo}</div>`;
            }
            
            // Get route coordinates between consecutive points
            if (i < route.route.length - 1) {
                processedSegments++;
                const progress = 60 + (processedSegments / totalSegments) * 40;
                showProgress(progress, `ルート計算中... (${processedSegments}/${totalSegments})`);
                
                const fromNode = nodeIndex === 0 ? depot : deliveries[nodeIndex - 1];
                const toNode = route.route[i + 1] === 0 ? depot : deliveries[route.route[i + 1] - 1];
                
                try {
                    const coords = await getRouteCoordinates(
                        fromNode.lon, fromNode.lat,
                        toNode.lon, toNode.lat
                    );
                    // Add all coordinates for this segment
                    routeCoordinates.push(...coords);
                } catch (error) {
                    console.error('Error getting route coordinates:', error);
                    // Fallback to straight line
                    routeCoordinates.push([fromNode.lat, fromNode.lon]);
                    if (i === route.route.length - 2) {
                        routeCoordinates.push([toNode.lat, toNode.lon]);
                    }
                }
            }
        }
        
        // Add return to depot if not already there
        if (route.route[route.route.length - 1] !== 0) {
            processedSegments++;
            const progress = 60 + (processedSegments / totalSegments) * 40;
            showProgress(progress, `ルート計算中... (${processedSegments}/${totalSegments})`);
            
            const lastNode = deliveries[route.route[route.route.length - 1] - 1];
            routeHtml += `<div class="route-stop">${route.route.length + 1}. 出発地点に戻る</div>`;
            
            try {
                const coords = await getRouteCoordinates(
                    lastNode.lon, lastNode.lat,
                    depot.lon, depot.lat
                );
                routeCoordinates.push(...coords.slice(1));
            } catch (error) {
                console.error('Error getting return route coordinates:', error);
                routeCoordinates.push([depot.lat, depot.lon]);
            }
        }
        
        routeHtml += '</div>';
        routeResults.innerHTML += routeHtml;
        
        if (routeCoordinates.length > 0) {
            // Use route coordinates directly without smoothing
            const polyline = L.polyline(routeCoordinates, {
                color: color,
                weight: 4,
                opacity: 0.7,
                smoothFactor: 1.0
            }).addTo(map);
            routes.push(polyline);
            
            // Store route data for animation
            routeAnimations.push({
                vehicleId: route.vehicle_id,
                vehicleName: vehicle.name,
                coordinates: routeCoordinates,
                color: color
            });
        }
    }
    
    // アニメーション制御ボタンを追加
    if (routeAnimations.length > 0) {
        routeResults.innerHTML += `
            <div style="margin-top: 20px; text-align: center;">
                <button onclick="startAnimation()" style="background: #2ecc71; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
                    アニメーション開始
                </button>
                <button onclick="stopAnimation()" style="background: #e74c3c; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px;">
                    アニメーション停止
                </button>
            </div>
            <div style="margin-top: 10px; text-align: center;">
                <label style="margin-right: 10px;">追従する車両:</label>
                <select id="followVehicleSelect" onchange="changeFollowingVehicle()" style="padding: 5px; border-radius: 3px; border: 1px solid #ddd;">
                    <option value="">なし</option>
                    ${routeAnimations.map((route, index) => 
                        `<option value="${index}">${route.vehicleName}</option>`
                    ).join('')}
                </select>
                
                <label style="margin-left: 20px; margin-right: 10px;">速度:</label>
                <select id="speedSelect" onchange="changeAnimationSpeed()" style="padding: 5px; border-radius: 3px; border: 1px solid #ddd;">
                    <option value="500">とても遅い</option>
                    <option value="300">遅い</option>
                    <option value="150" selected>標準</option>
                    <option value="75">速い</option>
                    <option value="30">とても速い</option>
                </select>
            </div>
        `;
    }
}

async function getRouteCoordinates(fromLon, fromLat, toLon, toLat) {
    console.log(`Getting route from (${fromLat}, ${fromLon}) to (${toLat}, ${toLon})`);
    
    try {
        // Use our server as proxy to avoid CORS issues
        const response = await fetch('/get_route', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                from_lon: fromLon,
                from_lat: fromLat,
                to_lon: toLon,
                to_lat: toLat
            })
        });
        
        console.log('Route response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Route response:', data);
        
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
            const coordinates = data.routes[0].geometry.coordinates;
            console.log('Route coordinates count:', coordinates.length);
            // Convert from [lon, lat] to [lat, lon] for Leaflet
            return coordinates.map(coord => [coord[1], coord[0]]);
        } else if (data.error) {
            console.error('Server error:', data.error);
        } else {
            console.warn('No valid route returned:', data);
        }
    } catch (error) {
        console.error('Route request failed:', error);
    }
    
    // Fallback to straight line
    console.log('Using fallback straight line');
    return [[fromLat, fromLon], [toLat, toLon]];
}

// 地図クリックモードの設定
function setDepotByMap() {
    mapClickMode = 'depot';
    showMapClickMessage('出発地点を地図上でクリックしてください');
    // 画面の一番上まで自動スクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setDeliveryByMap(deliveryId) {
    mapClickMode = 'delivery';
    mapClickDeliveryId = deliveryId;
    showMapClickMessage(`配送先 ${deliveryId} を地図上でクリックしてください`);
    // 画面の一番上まで自動スクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMapClickMessage(message) {
    // 既存のメッセージを削除
    const existingMsg = document.querySelector('.map-click-message');
    if (existingMsg) existingMsg.remove();
    
    // 新しいメッセージを表示
    const msgDiv = document.createElement('div');
    msgDiv.className = 'map-click-message';
    msgDiv.innerHTML = `
        <span>${message}</span>
        <button onclick="cancelMapClick()">キャンセル</button>
    `;
    document.querySelector('#map').parentElement.insertBefore(msgDiv, document.querySelector('#map'));
}

function cancelMapClick() {
    mapClickMode = null;
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    const msg = document.querySelector('.map-click-message');
    if (msg) msg.remove();
}

async function handleMapClick(latlng) {
    // 一時マーカーを表示
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([latlng.lat, latlng.lng], {
        icon: L.divIcon({
            html: '<div style="background-color: yellow; width: 20px; height: 20px; border-radius: 50%; border: 2px solid black;"></div>',
            iconSize: [20, 20],
            className: ''
        })
    }).addTo(map);
    
    try {
        // 逆ジオコーディング
        const response = await fetch('/reverse_geocode', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({lat: latlng.lat, lon: latlng.lng})
        });
        
        const data = await response.json();
        if (data.success) {
            if (mapClickMode === 'depot') {
                depot = {
                    address: data.address,
                    lat: latlng.lat,
                    lon: latlng.lng
                };
                document.getElementById('depot-address').value = data.address;
                document.getElementById('depot-result').innerHTML = 
                    `<small style="color: green;">✓ ${data.display_name}</small>`;
            } else if (mapClickMode === 'delivery') {
                const delivery = {
                    id: mapClickDeliveryId,
                    address: data.address,
                    lat: latlng.lat,
                    lon: latlng.lng
                };
                
                const index = deliveries.findIndex(d => d.id === mapClickDeliveryId);
                if (index >= 0) {
                    deliveries[index] = delivery;
                } else {
                    deliveries.push(delivery);
                }
                
                document.getElementById(`delivery-address-${mapClickDeliveryId}`).value = data.address;
                document.getElementById(`delivery-result-${mapClickDeliveryId}`).innerHTML = 
                    `<small style="color: green;">✓ ${data.display_name}</small>`;
            }
            
            updateMap();
            cancelMapClick();
        } else {
            alert('住所の取得に失敗しました');
        }
    } catch (error) {
        alert('エラーが発生しました: ' + error);
    }
}

let mapClickDeliveryId = null;

// 時間選択オプションを生成（10分間隔）
function generateTimeOptions() {
    let options = '';
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
            const totalMinutes = hour * 60 + minute;
            const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            options += `<option value="${totalMinutes}">${timeStr}</option>`;
        }
    }
    return options;
}

// 進捗バー表示
function showProgress(percentage, text) {
    const container = document.getElementById('progress-container');
    const bar = document.getElementById('progress-bar');
    const textElement = document.getElementById('progress-text');
    
    container.style.display = 'block';
    bar.style.width = percentage + '%';
    textElement.textContent = text;
}

// 進捗バー非表示
function hideProgress() {
    document.getElementById('progress-container').style.display = 'none';
}

// Create smooth route with curves
function createSmoothRoute(coordinates) {
    if (coordinates.length <= 2) return coordinates;
    
    const smoothed = [];
    smoothed.push(coordinates[0]);
    
    for (let i = 1; i < coordinates.length - 1; i++) {
        const prev = coordinates[i - 1];
        const curr = coordinates[i];
        const next = coordinates[i + 1];
        
        // Add intermediate points for smoother curves
        const steps = 5;
        for (let t = 0; t <= steps; t++) {
            const ratio = t / steps;
            const lat = curr[0] + (next[0] - prev[0]) * ratio * 0.1;
            const lon = curr[1] + (next[1] - prev[1]) * ratio * 0.1;
            smoothed.push([lat, lon]);
        }
    }
    
    smoothed.push(coordinates[coordinates.length - 1]);
    return smoothed;
}

// アニメーション関数
function startAnimation() {
    // 現在の追従設定を保存
    const currentFollowing = followingVehicle;
    
    stopAnimation(); // 既存のアニメーションを停止
    
    // 追従設定を復元
    followingVehicle = currentFollowing;
    animationCompleted = false;
    
    // 速度設定を保持
    const speedSelect = document.getElementById('speedSelect');
    if (speedSelect) {
        animationSpeed = parseInt(speedSelect.value);
    }
    
    let completedCount = 0;
    const totalVehicles = routeAnimations.length;
    
    routeAnimations.forEach((routeData, routeIndex) => {
        // 車両アイコンを作成
        const vehicleIcon = L.divIcon({
            html: `<div style="background-color: ${routeData.color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    ${routeData.vehicleId + 1}
                   </div>`,
            iconSize: [30, 30],
            className: 'vehicle-marker'
        });
        
        const vehicleMarker = L.marker(routeData.coordinates[0], {
            icon: vehicleIcon,
            zIndexOffset: 1000
        }).addTo(map);
        
        vehicleMarker.bindPopup(routeData.vehicleName);
        vehicleMarkers.push(vehicleMarker);
        
        // アニメーション設定
        let currentIndex = 0;
        routeData.currentIndex = 0;  // 現在位置を保存
        const totalPoints = routeData.coordinates.length;
        
        const animateVehicle = () => {
            const interval = setInterval(() => {
                if (currentIndex < totalPoints - 1) {
                    currentIndex++;
                    routeData.currentIndex = currentIndex;
                    const newLatLng = routeData.coordinates[currentIndex];
                    vehicleMarker.setLatLng(newLatLng);
                    
                    // 進行状況を表示
                    const progress = Math.round((currentIndex / totalPoints) * 100);
                    vehicleMarker.setPopupContent(`${routeData.vehicleName}<br>進行度: ${progress}%`);
                    
                    // 追従モードの場合、地図を移動（常に中心に表示）
                    if (followingVehicle !== null && followingVehicle === routeIndex && !userInteracting) {
                        // 現在のズームレベルを維持しながら中心に表示
                        map.setView(newLatLng, map.getZoom());
                    }
                } else {
                    // アニメーション終了（ループしない）
                    clearInterval(interval);
                    // 最終地点で停止
                    vehicleMarker.setPopupContent(`${routeData.vehicleName}<br>配送完了`);
                    
                    // 完了カウントを増やす
                    completedCount++;
                    if (completedCount === totalVehicles) {
                        animationCompleted = true;
                        // すべての車両が完了したら追従を解除
                        if (followingVehicle !== null) {
                            followingVehicle = null;
                            document.getElementById('followVehicleSelect').value = '';
                            // 全体表示に戻す
                            if (markers.length > 0) {
                                const group = new L.featureGroup(markers);
                                map.fitBounds(group.getBounds().pad(0.1));
                            }
                        }
                    }
                }
            }, animationSpeed);
            
            return interval;
        };
        
        const interval = animateVehicle();
        animationIntervals.push(interval);
        routeData.vehicleMarker = vehicleMarker;  // 後で参照できるように保存
    });
}

function stopAnimation() {
    // すべてのアニメーションを停止
    animationIntervals.forEach(interval => clearInterval(interval));
    animationIntervals = [];
    
    // 車両マーカーを削除
    vehicleMarkers.forEach(marker => map.removeLayer(marker));
    vehicleMarkers = [];
}

// 追従車両の変更
function changeFollowingVehicle() {
    const select = document.getElementById('followVehicleSelect');
    const value = select.value;
    
    if (value === '') {
        followingVehicle = null;
        // 全体表示に戻す
        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1));
        }
    } else {
        followingVehicle = parseInt(value);
        userInteracting = false;  // 追従を即座に開始
        // 選択した車両の現在位置にズーム（より近いズームレベルで）
        if (vehicleMarkers[followingVehicle]) {
            const currentPos = vehicleMarkers[followingVehicle].getLatLng();
            map.setView(currentPos, 16);  // より詳細な表示
        }
    }
}

// アニメーション速度の変更
function changeAnimationSpeed() {
    const select = document.getElementById('speedSelect');
    const newSpeed = parseInt(select.value);
    animationSpeed = newSpeed;
    
    // アニメーションが実行中の場合は再起動
    if (animationIntervals.length > 0) {
        const currentVehiclePositions = routeAnimations.map(route => route.currentIndex || 0);
        const currentFollowing = followingVehicle;
        
        stopAnimation();
        startAnimation();
        
        // 各車両の位置を復元
        routeAnimations.forEach((route, index) => {
            if (currentVehiclePositions[index] > 0) {
                route.currentIndex = currentVehiclePositions[index];
                if (route.vehicleMarker) {
                    route.vehicleMarker.setLatLng(route.coordinates[route.currentIndex]);
                }
            }
        });
        
        // 追従設定を復元
        if (currentFollowing !== null) {
            followingVehicle = currentFollowing;
            document.getElementById('followVehicleSelect').value = currentFollowing.toString();
        }
    }
}

// ページを離れる時にアニメーションを停止
window.addEventListener('beforeunload', stopAnimation);

// 荷物量の検証
function validateDemand(deliveryId) {
    const demandInput = document.getElementById(`delivery-demand-${deliveryId}`);
    const warningDiv = document.getElementById(`delivery-demand-warning-${deliveryId}`);
    const deliveryElement = document.getElementById(`delivery-${deliveryId}`);
    
    const demand = parseInt(demandInput.value) || 0;
    
    // 現在の最大車両容量を取得
    const vehicleElements = document.querySelectorAll('.vehicle-item');
    let maxCapacity = 0;
    
    vehicleElements.forEach(elem => {
        const id = elem.id.replace('vehicle-', '');
        const capacity = parseInt(document.getElementById(`vehicle-capacity-${id}`).value) || 0;
        maxCapacity = Math.max(maxCapacity, capacity);
    });
    
    // 検証
    if (demand > maxCapacity && maxCapacity > 0) {
        // エラー表示
        warningDiv.textContent = `警告: 荷物量(${demand})が最大車両容量(${maxCapacity})を超えています`;
        warningDiv.style.display = 'block';
        demandInput.style.border = '2px solid red';
        demandInput.style.backgroundColor = '#ffe6e6';
        deliveryElement.style.border = '2px solid #ff9999';
        deliveryElement.style.backgroundColor = '#fff5f5';
    } else {
        // エラーをクリア
        warningDiv.style.display = 'none';
        demandInput.style.border = '';
        demandInput.style.backgroundColor = '';
        deliveryElement.style.border = '';
        deliveryElement.style.backgroundColor = '';
    }
}

// 車両容量が変更されたときにすべての配送先を再検証
function validateAllDemands() {
    const deliveryElements = document.querySelectorAll('.delivery-item');
    deliveryElements.forEach(elem => {
        const id = elem.id.replace('delivery-', '');
        validateDemand(id);
    });
}