import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  LoaderCircle,
  MapPin,
  Search,
} from "lucide-react";

const submitButtonClassName =
  "mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl " +
  "bg-navy px-5 py-3 text-base font-bold text-white transition hover:bg-slate-800 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

function getDateLimit(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDateOnly(date);
}

function formatDateOnly(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateOnly(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function TripForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    departure_date: formatDateOnly(new Date()),
    departure_time: "08:00",
    load_weight: "40000",
    checkpoint_interval: "25",
  });
  const [error, setError] = useState("");
  const calendarWrapperRef = useRef(null);
  const timeWrapperRef = useRef(null);
  const intervalWrapperRef = useRef(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(`${form.departure_date}T00:00:00`),
  );
  const minDate = formatDateOnly(new Date());
  const maxDate = getDateLimit(7);

  useEffect(() => {
    const handleOutsideInteraction = (event) => {
      if (
        calendarWrapperRef.current &&
        !calendarWrapperRef.current.contains(event.target)
      ) {
        setCalendarOpen(false);
      }
      if (
        timeWrapperRef.current &&
        !timeWrapperRef.current.contains(event.target)
      ) {
        setTimeOpen(false);
      }
      if (
        intervalWrapperRef.current &&
        !intervalWrapperRef.current.contains(event.target)
      ) {
        setIntervalOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setCalendarOpen(false);
        setTimeOpen(false);
        setIntervalOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideInteraction);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideInteraction);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const chooseDate = (date) => {
    updateField("departure_date", formatDateOnly(date));
    setCalendarOpen(false);
  };

  const calendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingDays = firstDay.getDay();
    return Array.from({ length: leadingDays + daysInMonth }, (_, index) => {
      if (index < leadingDays) return null;
      return new Date(year, month, index - leadingDays + 1);
    });
  };

  const dateIsSelectable = (date) => {
    if (!date) return false;
    const value = formatDateOnly(date);
    return value >= minDate && value <= maxDate;
  };

  const selectedDateLabel = parseDateOnly(form.departure_date).toLocaleDateString(
    undefined,
    {
    month: "short",
    day: "numeric",
    year: "numeric",
    },
  );

  const [selectedHour, selectedMinute] = form.departure_time.split(":").map(Number);
  const selectedPeriod = selectedHour >= 12 ? "PM" : "AM";
  const displayHour = selectedHour % 12 || 12;
  const timeOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  const minuteOptions = ["00", "15", "30", "45"];

  const updateTime = (hour, minute, period) => {
    let nextHour = hour % 12;
    if (period === "PM") nextHour += 12;
    updateField(
      "departure_time",
      `${String(nextHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
  };

  const update = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.origin.trim() || !form.destination.trim()) {
      setError("Enter both an origin and destination.");
      return;
    }
    if (
      form.origin.trim().toLocaleLowerCase() ===
      form.destination.trim().toLocaleLowerCase()
    ) {
      setError("Origin and destination must be different locations.");
      return;
    }
    if (Number(form.load_weight) <= 0) {
      setError("Load weight must be greater than zero.");
      return;
    }
    if (
      Date.UTC(
        ...form.departure_date.split("-").map(Number).map((value, index) =>
          index === 1 ? value - 1 : value,
        ),
        ...form.departure_time.split(":").map(Number),
      ) <= Date.now()
    ) {
      setError("Departure must be in the future.");
      return;
    }

    setError("");
    onSubmit({
      ...form,
      load_weight: Number(form.load_weight),
      checkpoint_interval: Number(form.checkpoint_interval),
    });
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8"
    >
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
            Trip planner
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Plan a safer trip
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Compare real driving routes against weather at the truck&apos;s
            estimated arrival time.
          </p>
        </div>
        <Gauge className="hidden text-slate-300 sm:block" size={30} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
        {[
          ["origin", "Origin location", "Enter origin city", MapPin],
          ["destination", "Destination location", "Enter destination city", MapPin],
        ].map(([name, label, placeholder]) => (
          <label key={name} className="field xl:col-span-2">
            <span>{label}</span>
            <div className="input-with-icon">
              <input
                required
                name={name}
                value={form[name]}
                onChange={update}
                placeholder={placeholder}
              />
              <MapPin size={18} />
            </div>
          </label>
        ))}

        <label className="field xl:col-span-1">
          <span>Departure date</span>
          <div ref={calendarWrapperRef} className="picker-wrapper">
            <input type="hidden" name="departure_date" value={form.departure_date} />
            <button
              type="button"
              className="styled-picker-trigger"
              onClick={() => setCalendarOpen((open) => !open)}
              aria-expanded={calendarOpen}
              aria-haspopup="dialog"
            >
              <span>{selectedDateLabel}</span>
              <CalendarDays size={18} />
            </button>
            {calendarOpen && (
              <div className="calendar-popover" role="dialog" aria-label="Choose departure date">
                <div className="calendar-header">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() - 1,
                          1,
                        ),
                      )
                    }
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <strong>
                    {calendarMonth.toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
                <div className="calendar-weekdays">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="calendar-grid">
                  {calendarDays().map((date, index) => (
                    <button
                      key={date?.toISOString() || `empty-${index}`}
                      type="button"
                      disabled={!dateIsSelectable(date)}
                      className={
                        date &&
                        formatDateOnly(date) === form.departure_date
                          ? "selected"
                          : ""
                      }
                      onClick={() => date && chooseDate(date)}
                    >
                      {date?.getDate() || ""}
                    </button>
                  ))}
                </div>
                <p className="calendar-hint">Choose a date within the 7-day forecast.</p>
              </div>
            )}
          </div>
        </label>
        <label className="field xl:col-span-1">
          <span>Departure time (UTC)</span>
          <div ref={timeWrapperRef} className="picker-wrapper">
            <input type="hidden" name="departure_time" value={form.departure_time} />
            <button
              type="button"
              className="styled-picker-trigger"
              onClick={() => setTimeOpen((open) => !open)}
              aria-expanded={timeOpen}
              aria-haspopup="dialog"
            >
              <span>
                {String(displayHour).padStart(2, "0")}:
                {String(selectedMinute).padStart(2, "0")} {selectedPeriod}
              </span>
              <Clock3 size={18} />
            </button>
            {timeOpen && (
              <div className="time-popover" role="dialog" aria-label="Choose departure time">
                <div className="time-popover-heading">
                  <span>Departure time</span>
                  <small>UTC</small>
                </div>
                <div className="time-columns">
                  <div className="time-column">
                    <span className="time-column-label">Hour</span>
                    <div className="time-options">
                      {timeOptions.map((hour) => (
                        <button
                          type="button"
                          key={hour}
                          className={hour === displayHour ? "selected" : ""}
                          onClick={() => updateTime(hour, selectedMinute, selectedPeriod)}
                        >
                          {String(hour).padStart(2, "0")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="time-column">
                    <span className="time-column-label">Minute</span>
                    <div className="time-options">
                      {minuteOptions.map((minute) => (
                        <button
                          type="button"
                          key={minute}
                          className={Number(minute) === selectedMinute ? "selected" : ""}
                          onClick={() => updateTime(displayHour, Number(minute), selectedPeriod)}
                        >
                          {minute}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="time-column period-column">
                    <span className="time-column-label">Period</span>
                    <div className="time-options">
                      {["AM", "PM"].map((period) => (
                        <button
                          type="button"
                          key={period}
                          className={period === selectedPeriod ? "selected" : ""}
                          onClick={() => updateTime(displayHour, selectedMinute, period)}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="time-done"
                  onClick={() => setTimeOpen(false)}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </label>
        <label className="field xl:col-span-1">
          <span>Truck load (lb)</span>
          <input
            type="number"
            min="1"
            name="load_weight"
            value={form.load_weight}
            onChange={update}
          />
        </label>
        <label className="field xl:col-span-1">
          <span>Checkpoint interval</span>
          <div ref={intervalWrapperRef} className="picker-wrapper">
            <input type="hidden" name="checkpoint_interval" value={form.checkpoint_interval} />
            <button
              type="button"
              className="styled-picker-trigger"
              onClick={() => setIntervalOpen((open) => !open)}
              aria-expanded={intervalOpen}
              aria-haspopup="listbox"
            >
              <span>Every {form.checkpoint_interval} miles</span>
              <ChevronDown size={18} />
            </button>
            {intervalOpen && (
              <div className="interval-popover" role="listbox">
                {[10, 25, 50].map((interval) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={String(interval) === form.checkpoint_interval}
                    className={
                      String(interval) === form.checkpoint_interval ? "selected" : ""
                    }
                    key={interval}
                    onClick={() => {
                      updateField("checkpoint_interval", String(interval));
                      setIntervalOpen(false);
                    }}
                  >
                    <span>Every {interval} miles</span>
                    <small>{interval === 10 ? "Most detailed" : interval === 25 ? "Balanced" : "Quick overview"}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Forecast availability: today through the next 7 days.
        </p>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>

      <button
        disabled={loading}
        className={submitButtonClassName}
        type="submit"
      >
        {loading ? (
          <LoaderCircle className="animate-spin" size={18} />
        ) : (
          <Search size={18} />
        )}
        {loading ? "Analyzing routes..." : "Analyze routes"}
      </button>
    </form>
  );
}
