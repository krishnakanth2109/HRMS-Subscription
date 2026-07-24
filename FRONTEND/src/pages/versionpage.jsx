import React, { useState } from 'react';

// ============================================
// DUMMY DATA - Easy to update daily by editing this array only
// ============================================
const updates = [
  {
    date: "July 13, 2026",
    version: "v5.3.0",
    items: [
      {
        type: "new",
        title: "Performance Management",
        desc: "Introduced task assignment capabilities, allowing admins to seamlessly delegate, manage, and track employee tasks directly from the dashboard."
      }
    ]
  },
  {
    date: "May 19, 2026",
    version: "v5.2.0",
    items: [
      {
        type: "new",
        title: "Biometric Integration",
        desc: "Implemented advanced biometric authentication with improved attendance accuracy, faster verification, and reduced false punch-ins."
      },

    ]
  },
  {
    date: "April 25, 2026",
    version: "v5.1.1",
    items: [
      {
        type: "improved",
        title: "Performance Idle Detection",
        desc: "Improved accuracy and reduced false positives."
      },

      {
        type: "improved",
        title: "Performance Module UI",
        desc: "Improved UI and faster loading."
      }
    ]
  },
  // {
  //   date: "April 24, 2026",
  //   version: "v5.1.0",
  //   items: [
  //     {
  //       type: "fixed",
  //       title: "Onboarding Form Bug",
  //       desc: "Fixed onboarding Form submission. i.e. If come back from after submitted form then it will not show the form again and directly show the next step."
  //     }
  //   ]
  // },

];

// ============================================
// BADGE COMPONENT
// ============================================
const Badge = ({ type }) => {
  const styles = {
    new: "bg-emerald-100 text-emerald-700",
    improved: "bg-blue-100 text-blue-700",
    fixed: "bg-red-100 text-red-700"
  };

  const labels = {
    new: "NEW",
    improved: "IMPROVED",
    fixed: "FIXED"
  };

  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${styles[type]}`}>
      {labels[type]}
    </span>
  );
};

// ============================================
// UPDATE ITEM COMPONENT
// ============================================
const UpdateItem = ({ item }) => {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
        <Badge type={item.type} />
        <h3 className="font-semibold text-gray-800 text-lg">{item.title}</h3>
      </div>
      <p className="text-gray-500 text-sm ml-0 sm:ml-[3px]">{item.desc}</p>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const WhatsNew = () => {
  const [showAll, setShowAll] = useState(false);

  // Separate latest update from older ones
  const latestUpdate = updates[0];
  const olderUpdates = updates.slice(1);

  // Decide which updates to show
  const visibleUpdates = showAll ? olderUpdates : olderUpdates.slice(0, 3);
  const hasMore = olderUpdates.length > 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* HEADER SECTION */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 shadow-sm border border-gray-200 mb-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-gray-600">Live Updates</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
            What's New in <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">VWSync</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Daily updates and improvements in HRMS
          </p>

          <div className="mt-4 inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 shadow-sm">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-600">Current version</span>
            <span className="font-mono font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md text-sm">{latestUpdate.version}</span>
          </div>
        </div>

        {/* LATEST UPDATE - HIGHLIGHTED SECTION */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur-lg opacity-25 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-emerald-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                      <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-medium text-emerald-600">Latest Release</p>
                      <p className="text-xs text-gray-500 font-mono">{latestUpdate.version}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">{latestUpdate.date}</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {latestUpdate.items.map((item, idx) => (
                    <UpdateItem key={idx} item={item} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PREVIOUS UPDATES SECTION */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-px flex-1 bg-gray-200"></div>
            <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Previous Updates</span>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

          <div className="space-y-8">
            {visibleUpdates.map((update, idx) => (
              <div key={idx} className="relative pl-6 before:absolute before:left-[11px] before:top-6 before:bottom-0 before:w-px before:bg-gray-200 last:before:hidden">
                {/* Timeline dot */}
                <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                </div>

                {/* Update card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-700">{update.date}</span>
                        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{update.version}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {update.items.length} {update.items.length === 1 ? 'update' : 'updates'}
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      {update.items.map((item, itemIdx) => (
                        <UpdateItem key={itemIdx} item={item} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Expand/Collapse Button */}
          {hasMore && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowAll(!showAll)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
              >
                {showAll ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Show fewer updates
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Show {olderUpdates.length - 3} more updates
                  </>
                )}
              </button>
            </div>
          )}

          {/* Empty state when no older updates */}
          {olderUpdates.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">No previous updates available</p>
            </div>
          )}
        </div>

        {/* FOOTER NOTE */}
        <div className="mt-16 text-center text-xs text-gray-400 border-t border-gray-200 pt-8">
          <p>VWSync HRMS — Continuously improving your workforce management experience</p>
        </div>
      </div>
    </div>
  );
};

export default WhatsNew;