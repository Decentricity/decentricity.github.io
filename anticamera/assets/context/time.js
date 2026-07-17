export class TimeSensor {
    snapshot(now = new Date()) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
        const hour = now.getHours();
        return {
            iso: now.toISOString(),
            date: new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(now),
            time: new Intl.DateTimeFormat(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).format(now),
            timezone,
            hour,
            dayPeriod: this.dayPeriod(hour)
        };
    }
    dayPeriod(hour) {
        if (hour < 5 || hour >= 21) {
            return "night";
        }
        if (hour < 12) {
            return "morning";
        }
        if (hour < 18) {
            return "afternoon";
        }
        return "evening";
    }
}
