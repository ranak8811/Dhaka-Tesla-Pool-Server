-- Check Constraints
ALTER TABLE "vehicles" ADD CONSTRAINT "check_max_capacity" CHECK ("max_capacity" = 3);
ALTER TABLE "pools" ADD CONSTRAINT "check_occupied_seats" CHECK ("occupied_seats" >= 0 AND "occupied_seats" <= 3);
ALTER TABLE "ride_requests" ADD CONSTRAINT "check_seats_requested" CHECK ("seats_requested" >= 1 AND "seats_requested" <= 3);

-- Performance Indexes
CREATE INDEX "ix_vehicles_online_zone" ON "vehicles"("is_online", "current_zone");
CREATE INDEX "ix_pools_status_pickup" ON "pools"("status", "pickup_zone");
CREATE INDEX "ix_rides_passenger_status" ON "ride_requests"("passenger_id", "status");
CREATE INDEX "ix_rides_pool_id" ON "ride_requests"("pool_id");