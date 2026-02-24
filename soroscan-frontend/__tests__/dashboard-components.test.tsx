import { render, screen, fireEvent } from "@testing-library/react";
import { PaginationControls } from "@/app/dashboard/components/PaginationControls";

describe("Dashboard Components", () => {
  describe("PaginationControls", () => {
    it("renders pagination controls with correct page info", () => {
      const mockOnPageChange = jest.fn();
      
      render(
        <PaginationControls
          currentPage={2}
          hasNext={true}
          hasPrev={true}
          onPageChange={mockOnPageChange}
          startIndex={21}
          endIndex={40}
          totalCount={100}
        />
      );

      expect(screen.getByText("Page 2")).toBeInTheDocument();
      expect(screen.getByText(/Showing 21-40 of 100\+/)).toBeInTheDocument();
    });

    it("disables previous button on first page", () => {
      const mockOnPageChange = jest.fn();
      
      render(
        <PaginationControls
          currentPage={1}
          hasNext={true}
          hasPrev={false}
          onPageChange={mockOnPageChange}
          startIndex={1}
          endIndex={20}
          totalCount={100}
        />
      );

      const prevButton = screen.getByTitle("Previous page");
      expect(prevButton).toBeDisabled();
    });

    it("disables next button when no more pages", () => {
      const mockOnPageChange = jest.fn();
      
      render(
        <PaginationControls
          currentPage={5}
          hasNext={false}
          hasPrev={true}
          onPageChange={mockOnPageChange}
          startIndex={81}
          endIndex={100}
          totalCount={100}
        />
      );

      const nextButton = screen.getByTitle("Next page");
      expect(nextButton).toBeDisabled();
    });

    it("calls onPageChange when clicking next", () => {
      const mockOnPageChange = jest.fn();
      
      render(
        <PaginationControls
          currentPage={2}
          hasNext={true}
          hasPrev={true}
          onPageChange={mockOnPageChange}
          startIndex={21}
          endIndex={40}
          totalCount={100}
        />
      );

      const nextButton = screen.getByTitle("Next page");
      fireEvent.click(nextButton);
      
      expect(mockOnPageChange).toHaveBeenCalledWith(3);
    });

    it("calls onPageChange when clicking previous", () => {
      const mockOnPageChange = jest.fn();
      
      render(
        <PaginationControls
          currentPage={2}
          hasNext={true}
          hasPrev={true}
          onPageChange={mockOnPageChange}
          startIndex={21}
          endIndex={40}
          totalCount={100}
        />
      );

      const prevButton = screen.getByTitle("Previous page");
      fireEvent.click(prevButton);
      
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });

    it("calls onPageChange with page 1 when clicking first", () => {
      const mockOnPageChange = jest.fn();
      
      render(
        <PaginationControls
          currentPage={5}
          hasNext={true}
          hasPrev={true}
          onPageChange={mockOnPageChange}
          startIndex={81}
          endIndex={100}
          totalCount={200}
        />
      );

      const firstButton = screen.getByTitle("First page");
      fireEvent.click(firstButton);
      
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });
  });
});
