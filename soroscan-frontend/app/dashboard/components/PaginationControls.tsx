"use client";

import styles from "@/components/ingest/ingest-terminal.module.css";

interface PaginationControlsProps {
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
  startIndex: number;
  endIndex: number;
  totalCount: number;
}

export function PaginationControls({
  currentPage,
  hasNext,
  hasPrev,
  onPageChange,
  startIndex,
  endIndex,
  totalCount,
}: PaginationControlsProps) {
  return (
    <div className={styles.paginationRow}>
      <button
        type="button"
        className={`${styles.btn} ${styles.secondaryBtn}`}
        disabled={currentPage === 1}
        onClick={() => onPageChange(1)}
        title="First page"
      >
        ◄◄
      </button>
      
      <button
        type="button"
        className={`${styles.btn} ${styles.secondaryBtn}`}
        disabled={!hasPrev}
        onClick={() => onPageChange(currentPage - 1)}
        title="Previous page"
      >
        ◄ Previous
      </button>
      
      <span className={styles.pill}>
        Page {currentPage}
      </span>
      
      <span style={{ color: "#7ba8b5", fontSize: "0.85rem" }}>
        Showing {startIndex}-{endIndex} of {totalCount}+
      </span>
      
      <button
        type="button"
        className={`${styles.btn} ${styles.secondaryBtn}`}
        disabled={!hasNext}
        onClick={() => onPageChange(currentPage + 1)}
        title="Next page"
      >
        Next ►
      </button>
      
      <button
        type="button"
        className={`${styles.btn} ${styles.secondaryBtn}`}
        disabled={!hasNext}
        onClick={() => {
          // Jump ahead by 10 pages
          onPageChange(currentPage + 10);
        }}
        title="Jump forward"
      >
        ►►
      </button>
    </div>
  );
}
