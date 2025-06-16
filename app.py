from flask import Flask, render_template, request, jsonify, send_from_directory
import requests
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from geopy.geocoders import Nominatim
import json
from vrp_solver import optimize_with_reload

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/test')
def test():
    return send_from_directory('.', 'test.html')

@app.route('/simple_test')
def simple_test():
    return send_from_directory('.', 'simple_test.html')

@app.route('/test_route')
def test_route():
    return send_from_directory('.', 'test_route.html')

@app.route('/debug_test')
def debug_test():
    return send_from_directory('.', 'debug_test.html')

@app.route('/geocode', methods=['POST'])
def geocode_address():
    data = request.json
    address = data.get('address')
    
    geolocator = Nominatim(user_agent="delivery-route-optimizer")
    try:
        location = geolocator.geocode(address, language='ja')
        if location:
            return jsonify({
                'success': True,
                'lat': location.latitude,
                'lon': location.longitude,
                'display_name': location.address
            })
        else:
            return jsonify({'success': False, 'error': '住所が見つかりませんでした'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/reverse_geocode', methods=['POST'])
def reverse_geocode():
    data = request.json
    lat = data.get('lat')
    lon = data.get('lon')
    
    geolocator = Nominatim(user_agent="delivery-route-optimizer")
    try:
        location = geolocator.reverse(f"{lat}, {lon}", language='ja')
        if location:
            return jsonify({
                'success': True,
                'address': location.address,
                'display_name': location.address
            })
        else:
            return jsonify({'success': False, 'error': '住所が見つかりませんでした'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/get_route', methods=['POST'])
def get_route():
    try:
        data = request.json
        from_lat, from_lon = float(data['from_lat']), float(data['from_lon'])
        to_lat, to_lon = float(data['to_lat']), float(data['to_lon'])
        print(f"Get route: ({from_lat}, {from_lon}) -> ({to_lat}, {to_lon})")
        
        # Try OSRM Demo Server (most reliable free option)
        try:
            url = f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{from_lon},{from_lat};{to_lon},{to_lat}?geometries=geojson&overview=full"
            headers = {
                'User-Agent': 'DeliveryRouteOptimizer/1.0',
                'Accept': 'application/json'
            }
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 'Ok' and data.get('routes') and len(data['routes']) > 0:
                    coordinates = data['routes'][0]['geometry']['coordinates']
                    print(f"OSRM Demo returned {len(coordinates)} coordinates")
                    return jsonify({
                        'code': 'Ok',
                        'routes': [{
                            'geometry': {
                                'coordinates': coordinates
                            }
                        }]
                    })
        except Exception as e:
            print(f"OSRM Demo error: {e}")
        
        # Try alternative OSRM server
        try:
            url = f"http://router.project-osrm.org/route/v1/driving/{from_lon},{from_lat};{to_lon},{to_lat}?geometries=geojson&overview=full"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 'Ok' and data.get('routes'):
                    coordinates = data['routes'][0]['geometry']['coordinates']
                    print(f"OSRM returned {len(coordinates)} coordinates")
                    return jsonify({
                        'code': 'Ok',
                        'routes': [{
                            'geometry': {
                                'coordinates': coordinates
                            }
                        }]
                    })
        except Exception as e:
            print(f"OSRM error: {e}")
        
        # Try Valhalla public instance with better error handling
        try:
            valhalla_query = {
                "locations": [
                    {"lat": from_lat, "lon": from_lon},
                    {"lat": to_lat, "lon": to_lon}
                ],
                "costing": "auto",
                "directions_options": {
                    "units": "kilometers"
                }
            }
            
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'DeliveryRouteOptimizer/1.0'
            }
            
            url = "https://valhalla1.openstreetmap.de/route"
            response = requests.post(url, json=valhalla_query, headers=headers, timeout=10)
            
            if response.status_code == 200:
                valhalla_data = response.json()
                if 'trip' in valhalla_data and 'legs' in valhalla_data['trip']:
                    coordinates = []
                    for leg in valhalla_data['trip']['legs']:
                        if 'shape' in leg:
                            # Decode the polyline
                            import polyline
                            decoded = polyline.decode(leg['shape'])
                            coordinates.extend([[lon, lat] for lat, lon in decoded])
                    
                    if coordinates:
                        print(f"Valhalla returned {len(coordinates)} coordinates")
                        return jsonify({
                            'code': 'Ok',
                            'routes': [{
                                'geometry': {
                                    'coordinates': coordinates
                                }
                            }]
                        })
        except Exception as e:
            print(f"Valhalla error: {e}")
        
        # Fallback to curved route with multiple points
        import math
        
        # Calculate distance
        distance = math.sqrt((to_lat - from_lat)**2 + (to_lon - from_lon)**2)
        num_points = max(10, int(distance * 150))  # More points for smoother curves
        
        coordinates = []
        for i in range(num_points + 1):
            t = i / num_points
            
            # Create a curved path using sine wave
            lat = from_lat + (to_lat - from_lat) * t
            lon = from_lon + (to_lon - from_lon) * t
            
            # Add curve offset
            perpendicular_offset = math.sin(t * math.pi) * distance * 0.1
            angle = math.atan2(to_lat - from_lat, to_lon - from_lon) + math.pi/2
            
            lat += perpendicular_offset * math.sin(angle)
            lon += perpendicular_offset * math.cos(angle)
            
            coordinates.append([lon, lat])
        
        result = {
            'code': 'Ok',
            'routes': [{
                'geometry': {
                    'coordinates': coordinates
                }
            }]
        }
        print(f"Returning fallback curved route with {len(coordinates)} points")
        return jsonify(result)
        
    except Exception as e:
        print(f"Route error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/optimize', methods=['POST'])
def optimize_route():
    try:
        data = request.json
        print(f"Received optimize request: {data}")
        
        depot = data['depot']
        deliveries = data['deliveries']
        vehicles = data['vehicles']
        min_road_width = data.get('min_road_width', 0)
        
        print(f"Minimum road width: {min_road_width}m")
        
        # 事前検証: 単一配送が車両容量を超えている場合の警告
        max_capacity = max(v['capacity'] for v in vehicles)
        oversized_deliveries = []
        split_warnings = []
        
        for delivery in deliveries:
            if delivery.get('demand', 0) > max_capacity:
                splits_needed = (delivery.get('demand', 0) + max_capacity - 1) // max_capacity
                oversized_deliveries.append({
                    'id': delivery['id'],
                    'address': delivery['address'],
                    'demand': delivery.get('demand', 0),
                    'max_capacity': max_capacity,
                    'splits_needed': splits_needed
                })
                split_warnings.append(f"配送先{delivery['id']} ({delivery['address']}) は{splits_needed}回に分けて配送されます")
        
        # 分割配送の警告をログに出力
        if split_warnings:
            print(f"Split deliveries required: {len(split_warnings)} locations")
            for warning in split_warnings:
                print(f"  - {warning}")
        
        locations = [depot] + deliveries
        
        print("Building distance matrix...")
        # 進捗状況を表示
        total_calculations = len(locations) * (len(locations) - 1) // 2
        print(f"Need to calculate {total_calculations} distances")
        distance_matrix = get_distance_matrix_with_progress(locations, total_calculations, min_road_width)
        print(f"Distance matrix built: {len(distance_matrix)}x{len(distance_matrix)}")
        
        print("Solving VRP...")
        optimized_routes = solve_vrp(
            distance_matrix,
            len(vehicles),
            [d.get('demand', 0) for d in deliveries],
            [v.get('capacity', float('inf')) for v in vehicles],
            [d.get('time_window', None) for d in deliveries],
            [d.get('priority', 0) for d in deliveries],
            [d.get('service_time', 0) for d in deliveries],
            locations,
            min_road_width
        )
        
        print(f"VRP solved: {optimized_routes}")
        
        # 分割配送情報を結果に追加
        if oversized_deliveries:
            optimized_routes['split_deliveries'] = oversized_deliveries
            optimized_routes['split_warnings'] = split_warnings
        
        return jsonify(optimized_routes)
    except Exception as e:
        print(f"Error in optimize_route: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})

def get_distance_matrix(locations):
    n = len(locations)
    matrix = [[0] * n for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            if i != j:
                matrix[i][j] = get_osrm_distance(
                    locations[i]['lat'], locations[i]['lon'],
                    locations[j]['lat'], locations[j]['lon']
                )
    
    return matrix

def get_distance_matrix_with_progress(locations, total_calculations, min_road_width=0):
    n = len(locations)
    matrix = [[0] * n for _ in range(n)]
    calculated = 0
    
    for i in range(n):
        for j in range(i + 1, n):
            # 対称性を利用（i->jとj->iは同じ距離）
            distance = get_osrm_distance(
                locations[i]['lat'], locations[i]['lon'],
                locations[j]['lat'], locations[j]['lon'],
                min_road_width
            )
            matrix[i][j] = distance
            matrix[j][i] = distance
            
            calculated += 1
            if calculated % 10 == 0:
                print(f"Calculated {calculated}/{total_calculations} distances...")
    
    return matrix

def get_osrm_distance(lat1, lon1, lat2, lon2, min_road_width=0):
    # ハイブリッド方式: 近距離は係数、遠距離は実際の道路距離
    euclidean_dist = calculate_euclidean_distance(lat1, lon1, lat2, lon2)
    
    # 10km以下は直線距離×1.3の係数を使用（高速）
    if euclidean_dist <= 10:
        # 道幅制限がある場合はペナルティを追加
        base_time = euclidean_dist * 1.3 * 60
        if min_road_width > 0:
            # 道幅制限がある場合、住宅街などを避けるためペナルティを追加
            # 2.5m制限: +10%, 3.0m制限: +20%, 3.5m制限: +30%, 4.0m制限: +40%
            penalty_factor = 1 + (min_road_width - 2) * 0.2
            return base_time * penalty_factor
        return base_time
    
    # 10km超は実際の道路距離を取得
    try:
        # OSRM APIを呼び出し
        url = f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
        headers = {
            'User-Agent': 'DeliveryRouteOptimizer/1.0',
            'Accept': 'application/json'
        }
        response = requests.get(url, headers=headers, timeout=2)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == 'Ok' and data.get('routes'):
                # 実際の道路距離（メートル）を取得してkmに変換
                distance_meters = data['routes'][0]['distance']
                distance_km = distance_meters / 1000
                # 実際の走行時間（秒）を取得して分に変換
                duration_seconds = data['routes'][0]['duration']
                duration_minutes = duration_seconds / 60
                return duration_minutes
    except Exception as e:
        print(f"OSRM error for long distance: {e}")
    
    # フォールバック: 遠距離も係数を使用（1.5倍）
    return euclidean_dist * 1.5 * 60

def calculate_euclidean_distance(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, sqrt, atan2
    
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c

def get_route_coordinates(lat1, lon1, lat2, lon2):
    url = f"http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?geometries=geojson"
    
    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        
        if data['code'] == 'Ok':
            coordinates = data['routes'][0]['geometry']['coordinates']
            # Convert from [lon, lat] to [lat, lon]
            return [[coord[1], coord[0]] for coord in coordinates]
        else:
            return [[lat1, lon1], [lat2, lon2]]
    except Exception as e:
        print(f"OSRM route error: {e}")
        return [[lat1, lon1], [lat2, lon2]]

def solve_vrp(distance_matrix, num_vehicles, demands, capacities, time_windows, priorities, service_times, locations, min_road_width=0):
    try:
        # デバッグ情報を出力
        print(f"Total demands: {sum(demands)}")
        print(f"Vehicle capacities: {capacities}")
        print(f"Individual demands: {demands}")
        
        # 補充を可能にするため、デポへの複数回訪問を許可
        manager = pywrapcp.RoutingIndexManager(len(distance_matrix), num_vehicles, 0)
        routing = pywrapcp.RoutingModel(manager)
        
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int(distance_matrix[from_node][to_node])
        
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    
        if any(d > 0 for d in demands):
            def demand_callback(from_index):
                from_node = manager.IndexToNode(from_index)
                if from_node == 0:
                    return 0
                return int(demands[from_node - 1])
            
            demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
            
            # 容量制約を追加（補充可能にするため、車両がデポに戻ることを許可）
            routing.AddDimensionWithVehicleCapacity(
                demand_callback_index,
                0,  # スラック（余裕）は0
                capacities,
                True,  # デポで容量をリセット（補充）
                'Capacity'
            )
        
        if any(tw is not None for tw in time_windows):
            def time_callback(from_index, to_index):
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                travel_time = int(distance_matrix[from_node][to_node])
                service_time = int(service_times[to_node - 1] if to_node > 0 else 0)
                return travel_time + service_time
            
            time_callback_index = routing.RegisterTransitCallback(time_callback)
            routing.AddDimension(
                time_callback_index,
                30,
                30000,
                False,
                'Time'
            )
            
            time_dimension = routing.GetDimensionOrDie('Time')
            for location_idx, tw in enumerate(time_windows):
                if tw and location_idx > 0:
                    index = manager.NodeToIndex(location_idx + 1)
                    time_dimension.CumulVar(index).SetRange(int(tw[0]), int(tw[1]))
        
        # すべての配送先を必須にしない（補充を許可するため）
        # 代わりに、ソリューション後に未訪問をチェック
        
        # 容量制約を緩和してデバッグ
        if any(d > 0 for d in demands):
            capacity_dimension = routing.GetDimensionOrDie('Capacity')
            # デポでの補充を明示的に設定
            for vehicle_id in range(num_vehicles):
                index = routing.Start(vehicle_id)
                capacity_dimension.SlackVar(index).SetValue(0)
        
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.FromSeconds(10)  # より長い時間を許可
        
        solution = routing.SolveWithParameters(search_parameters)
        
        routes = []
        unvisited = []
        
        if solution:
            # 訪問済みの配送先を記録
            visited_nodes = set([0])  # デポは常に訪問済み
            
            for vehicle_id in range(num_vehicles):
                route = []
                index = routing.Start(vehicle_id)
                
                while not routing.IsEnd(index):
                    node_index = manager.IndexToNode(index)
                    route.append(node_index)
                    visited_nodes.add(node_index)
                    index = solution.Value(routing.NextVar(index))
                
                if len(route) > 1:
                    vehicle_route_coords = []
                    current_load = 0
                    route_with_loads = []
                    
                    for i, node_idx in enumerate(route):
                        loc = locations[node_idx]
                        vehicle_route_coords.append([loc['lat'], loc['lon']])
                        
                        if node_idx == 0:
                            # デポで補充
                            current_load = 0
                            route_with_loads.append({
                                'node': node_idx,
                                'type': 'depot',
                                'action': '補充' if i > 0 else '出発',
                                'load': current_load
                            })
                        else:
                            # 配送先
                            demand = demands[node_idx - 1] if node_idx - 1 < len(demands) else 0
                            current_load += demand
                            route_with_loads.append({
                                'node': node_idx,
                                'type': 'delivery',
                                'demand': demand,
                                'load': current_load
                            })
                    
                    if route[-1] != 0:
                        vehicle_route_coords.append([locations[0]['lat'], locations[0]['lon']])
                        route_with_loads.append({
                            'node': 0,
                            'type': 'depot',
                            'action': '帰還',
                            'load': current_load
                        })
                    
                    # 道幅制限の情報を追加
                    route_info = {
                        'vehicle_id': vehicle_id,
                        'route': route,
                        'route_with_loads': route_with_loads,
                        'route_coordinates': vehicle_route_coords,
                        'total_distance': solution.ObjectiveValue() if vehicle_id == 0 else 0
                    }
                    
                    if min_road_width > 0:
                        route_info['min_road_width'] = min_road_width
                        route_info['road_width_notice'] = f'このルートは{min_road_width}m以上の道路を優先して使用します'
                    
                    routes.append(route_info)
            
            # 未訪問の配送先を確認
            for i in range(1, len(locations)):
                if i not in visited_nodes:
                    unvisited.append({
                        'index': i,
                        'location': locations[i],
                        'demand': demands[i-1] if i-1 < len(demands) else 0
                    })
            
            if unvisited:
                print(f"Warning: {len(unvisited)} deliveries were not assigned to any vehicle")
                for u in unvisited:
                    print(f"  - Delivery {u['index']}: {u['location'].get('address', 'Unknown')} (demand: {u['demand']})")
                
                # 容量不足の可能性をチェック
                total_unvisited_demand = sum(u['demand'] for u in unvisited)
                total_capacity = sum(capacities)
                print(f"Total unvisited demand: {total_unvisited_demand}")
                print(f"Total vehicle capacity: {total_capacity}")
        else:
            print("No solution found!")
            # すべてを未訪問として扱う
            for i in range(1, len(locations)):
                unvisited.append({
                    'index': i,
                    'location': locations[i],
                    'demand': demands[i-1] if i-1 < len(demands) else 0
                })
        
        # 解が見つからない、または未訪問がある場合は補充アルゴリズムを使用
        if not solution or len(unvisited) > 0:
            print("Using reload algorithm due to capacity constraints")
            reload_routes = optimize_with_reload(locations, demands, capacities, num_vehicles)
            
            routes = []
            for vehicle_id, reload_route in enumerate(reload_routes):
                if vehicle_id >= num_vehicles:
                    break
                    
                route_coords = []
                for node_idx in reload_route['route']:
                    loc = locations[node_idx]
                    route_coords.append([loc['lat'], loc['lon']])
                
                route_info = {
                    'vehicle_id': vehicle_id,
                    'route': reload_route['route'],
                    'route_coordinates': route_coords,
                    'total_distance': 0,
                    'reload_info': reload_route['locations']
                }
                
                if min_road_width > 0:
                    route_info['min_road_width'] = min_road_width
                    route_info['road_width_notice'] = f'このルートは{min_road_width}m以上の道路を優先して使用します'
                
                routes.append(route_info)
            
            # まだ未訪問がある場合
            assigned_deliveries = set()
            for r in reload_routes[:num_vehicles]:
                for node in r['route']:
                    if node > 0:
                        assigned_deliveries.add(node)
            
            unvisited_count = len(locations) - 1 - len(assigned_deliveries)
            return {'success': True, 'routes': routes, 'unvisited': unvisited_count}
        
        return {'success': True, 'routes': routes, 'unvisited': len(unvisited)}
    
    except Exception as e:
        print(f"VRP solver error: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting server on port {port}")
    print(f"Access the application at: http://localhost:{port}")
    app.run(debug=True, host='0.0.0.0', port=port)