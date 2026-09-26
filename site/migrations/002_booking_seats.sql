ALTER TABLE bookings ADD COLUMN cal_seat_uid text;
CREATE INDEX bookings_cal_uid_idx ON bookings(cal_uid);
