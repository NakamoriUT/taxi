"""
補充を考慮した配送ルート最適化
積載量を超える場合は自動的にデポに戻って補充する
"""

def create_routes_with_reload(locations, demands, vehicle_capacity):
    """
    積載量を考慮して、必要に応じてデポに戻るルートを作成
    単一配送が車両容量を超える場合は、複数回に分けて配送
    """
    routes = []
    unassigned = list(range(1, len(locations)))  # 配送先のインデックス（デポを除く）
    
    # 大きすぎる配送を分割
    split_deliveries = {}  # {original_idx: [split_demands]}
    for i, idx in enumerate(unassigned[:]):
        demand = demands[idx - 1]
        if demand > vehicle_capacity:
            # 配送を分割
            splits = []
            remaining = demand
            while remaining > 0:
                split_size = min(remaining, vehicle_capacity)
                splits.append(split_size)
                remaining -= split_size
            split_deliveries[idx] = splits
            print(f"Delivery {idx} (demand: {demand}) split into {len(splits)} trips: {splits}")
    
    print(f"Split deliveries: {split_deliveries}")
    
    while unassigned:
        route = [0]  # デポから開始
        current_load = 0
        route_locations = []
        
        print(f"\nStarting new route, unassigned: {unassigned}")
        print(f"Split deliveries remaining: {split_deliveries}")
        
        i = 0
        while i < len(unassigned):
            delivery_idx = unassigned[i]
            
            # 分割配送の場合
            if delivery_idx in split_deliveries and split_deliveries[delivery_idx]:
                # 次の分割分を取得
                demand = split_deliveries[delivery_idx][0]
                
                if current_load + demand <= vehicle_capacity:
                    # 積載可能
                    route.append(delivery_idx)
                    current_load += demand
                    route_locations.append({
                        'index': delivery_idx,
                        'demand': demand,
                        'cumulative_load': current_load,
                        'split_info': f"分割配送 (残り{len(split_deliveries[delivery_idx]) - 1}回)"
                    })
                    split_deliveries[delivery_idx].pop(0)
                    
                    # すべての分割が完了したら未割当から削除
                    if not split_deliveries[delivery_idx]:
                        unassigned.pop(i)
                        print(f"Delivery {delivery_idx} completed all splits")
                    else:
                        print(f"Delivery {delivery_idx} still has {len(split_deliveries[delivery_idx])} splits remaining")
                        # 分割が残っている場合はiを進めない（次のルートで再度処理）
                else:
                    # デポに戻って補充
                    if current_load > 0:
                        route.append(0)
                        route_locations.append({
                            'index': 0,
                            'action': 'reload',
                            'previous_load': current_load
                        })
                        current_load = 0
                    # 次のループで再度試行
                    continue
            else:
                # 通常の配送
                demand = demands[delivery_idx - 1]
                
                if current_load + demand <= vehicle_capacity:
                    # 積載可能
                    route.append(delivery_idx)
                    current_load += demand
                    route_locations.append({
                        'index': delivery_idx,
                        'demand': demand,
                        'cumulative_load': current_load
                    })
                    unassigned.pop(i)
                else:
                    # デポに戻って補充
                    if current_load > 0:
                        route.append(0)
                        route_locations.append({
                            'index': 0,
                            'action': 'reload',
                            'previous_load': current_load
                        })
                        current_load = 0
                    # 次のループで再度試行
                    continue
        
        if len(route) > 1:
            route.append(0)  # デポに戻る
            routes.append({
                'route': route,
                'locations': route_locations,
                'total_deliveries': len([loc for loc in route_locations if loc.get('index', 0) > 0])
            })
            print(f"Generated route: {route}")
            print(f"Route locations: {route_locations}")
            
            # 分割配送が残っている配送先を確認
            remaining_splits = []
            for idx in list(split_deliveries.keys()):
                if split_deliveries[idx]:
                    if idx not in unassigned:
                        remaining_splits.append(idx)
            
            # 残っている分割配送をunassignedに追加
            for idx in remaining_splits:
                if idx not in unassigned:
                    unassigned.append(idx)
                    print(f"Re-adding delivery {idx} to unassigned for remaining splits")
    
    return routes


def optimize_with_reload(locations, demands, capacities, num_vehicles):
    """
    補充を考慮した最適化
    """
    # 各車両の容量で最大のものを使用
    max_capacity = max(capacities)
    
    # 基本的なルートを作成
    basic_routes = create_routes_with_reload(locations, demands, max_capacity)
    
    # 車両数に合わせて調整
    if len(basic_routes) <= num_vehicles:
        # 十分な車両がある
        return basic_routes
    else:
        # 車両が不足している場合は、容量を調整して再計算
        print(f"Need {len(basic_routes)} vehicles but only have {num_vehicles}")
        return basic_routes[:num_vehicles]  # 一部のみ返す