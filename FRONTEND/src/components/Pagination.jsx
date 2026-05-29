import React from "react";

/**
 * Reusable pagination component with dynamic visible pages.
 *
 * Props:
 * - totalItems (number): Total count of items.
 * - itemsPerPage (number): Items rendered per page.
 * - currentPage (number): Current active page.
 * - onPageChange (function): Callback when page changes.
 * - containerClass (string): Optional custom wrapper class styles.
 */
const Pagination = ({
  totalItems,
  itemsPerPage = 10,
  currentPage = 1,
  onPageChange,
  containerClass = "flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 select-none",
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  if (totalPages <= 1) return null;

  const handlePrev = () => {
    if (currentPage > 1 && onPageChange) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages && onPageChange) {
      onPageChange(currentPage + 1);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let page = 1; page <= totalPages; page += 1) pages.push(page);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);

      if (currentPage <= 3) {
        end = 5;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 4;
      }

      for (let page = start; page <= end; page += 1) pages.push(page);
    }

    return pages;
  };

  return (
    <div className={containerClass}>
      <span className="text-xs font-semibold text-gray-500">
        Showing page <strong className="text-gray-800">{currentPage}</strong> of{" "}
        <strong className="text-gray-800">{totalPages}</strong>
        <span aria-hidden="true" className="mx-1 text-gray-300">
          &bull;
        </span>
        <strong className="text-gray-700">{totalItems}</strong> items total
      </span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentPage === 1}
          className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:hover:bg-transparent text-gray-600 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {getPageNumbers().map((pageNum) => (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange && onPageChange(pageNum)}
            className={`w-7 h-7 rounded-lg font-bold text-xs transition-all flex items-center justify-center cursor-pointer ${
              currentPage === pageNum
                ? "bg-gray-900 text-white shadow-md"
                : "border border-gray-200 hover:bg-gray-100 text-gray-600"
            }`}
          >
            {pageNum}
          </button>
        ))}

        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:hover:bg-transparent text-gray-600 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Pagination;
