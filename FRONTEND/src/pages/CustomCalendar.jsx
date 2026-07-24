const CustomCalendar = ({ selectedDate, setSelectedDate, holidays }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  const startDay = startOfMonth.getDay();
  const totalDays = endOfMonth.getDate();

  const daysArray = [];

  // Blank days before the 1st
  for (let i = 0; i < startDay; i++) {
    daysArray.push(null);
  }

  // Actual month days
  for (let d = 1; d <= totalDays; d++) {
    daysArray.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
  }

  const isHoliday = (date) =>
    holidays.some(
      (h) => new Date(h.date).toDateString() === date.toDateString()
    );

  const isSameDate = (a, b) =>
    a.toDateString() === b.toDateString();

  return (
    <div className="bg-white shadow-xl p-8 rounded-3xl w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() =>
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
            )
          }
          className="text-2xl"
        >
          ‹
        </button>

        <h2 className="text-2xl font-bold">
          {currentMonth.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </h2>

        <button
          onClick={() =>
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
            )
          }
          className="text-2xl"
        >
          ›
        </button>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 text-center font-semibold text-gray-700 mb-3">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-3 text-center">
        {daysArray.map((date, i) => {
          if (!date) return <div key={i}></div>; // empty slot

          const weekend = date.getDay() === 0 || date.getDay() === 6;
          const holiday = isHoliday(date);
          const active = isSameDate(date, selectedDate);

          // tile background rules
          let bg = "bg-gray-100";
          let text = "text-gray-800";

          if (weekend) {
            bg = "bg-red-100";
            text = "text-red-700";
          }
          if (holiday) {
            bg = "bg-green-500 text-white font-bold";
          }
          if (active) {
            bg = "bg-blue-600";
            text = "text-white font-bold";
          }

          return (
            <div
              key={i}
              onClick={() => setSelectedDate(date)}
              className={`${bg} ${text} p-4 rounded-xl cursor-pointer`}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
};
