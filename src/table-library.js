/**
 * TABLE LIBRARY - Smart Frontend Table Library
 * A lightweight, customizable table library with filtering, actions, and rich data display
 */

(function (global) {
  "use strict";

  class TableLibrary {
    /**
     * Initialize the table library with configuration
     */
    constructor(config = {}) {
      this.config = {
        container: config.container || "body",
        headings: config.headings || [],
        data: config.data || [],
        tableID: config.tableID || "smart-table-" + Date.now(),
        hideColumns: config.hideColumns || [],
        modifyConfig: config.modifyConfig || {},
        downloadConfig: config.downloadConfig || {},
        ...config,
      };

      this.sortState = {
        colIndex: null,
        direction: null, // 'asc' | 'desc'
      };

      this.processedData = [];
      this.processedHeadings = [];
      this.filteredData = [];
      this.displayData = []; // Data as shown in table (with modifications)

      this.init();
    }

    /**
     * Format dates in a user-friendly way
     */
    formatDateOrTimestamp(dateObj) {
      if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return "";

      const isDateOnly =
        dateObj.getUTCHours() === 0 &&
        dateObj.getUTCMinutes() === 0 &&
        dateObj.getUTCSeconds() === 0;

      const options = isDateOnly
        ? { day: "2-digit", month: "short", year: "numeric" }
        : {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          };

      return new Intl.DateTimeFormat("en-IN", options).format(dateObj);
    }

    /**
     * Apply user-defined modifications to specific cells or columns
     */
    applyModifications(data, headings) {
      if (!this.config.modifyConfig) return data;

      return data.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const heading = headings[colIndex];
          const ruleByHeading = this.config.modifyConfig[heading];
          const ruleByIndex =
            this.config.modifyConfig[`${rowIndex},${colIndex}`];

          let modified = cell;
          try {
            if (typeof ruleByHeading === "function") {
              modified = ruleByHeading(cell, row, rowIndex, colIndex);
            }
            if (typeof ruleByIndex === "function") {
              modified = ruleByIndex(cell, row, rowIndex, colIndex);
            }
          } catch (err) {
            console.error(
              `Error modifying ${heading}[${rowIndex},${colIndex}]:`,
              err
            );
          }
          return modified;
        })
      );
    }

    /**
     * Hide specified columns from the table
     */
    hideColumns(headings, data) {
      const hideCols = Array.isArray(this.config.hideColumns)
        ? this.config.hideColumns
        : [this.config.hideColumns];

      const hideIndexes = hideCols
        .map((col) => (typeof col === "number" ? col : headings.indexOf(col)))
        .filter((i) => i >= 0);

      return {
        headings: headings.filter((_, i) => !hideIndexes.includes(i)),
        data: data.map((row) => row.filter((_, i) => !hideIndexes.includes(i))),
      };
    }

    /**
     * Check if a column contains numeric data
     */
    isNumericColumn(colIndex) {
      return this.processedData.some((row) => {
        const val = row[colIndex];
        return typeof val === "number" && !isNaN(val);
      });
    }

    /**
     * Calculate metric (sum, avg, max, min) for a specific column
     */
    calculateMetric(colIndex, type) {
      const values = this.filteredData
        .map((row) => row[colIndex])
        .filter((v) => typeof v === "number" && !isNaN(v));

      if (values.length === 0) return "";

      switch (type) {
        case "sum":
          return values.reduce((a, b) => a + b, 0).toFixed(2);
        case "avg":
          return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
        case "max":
          return Math.max(...values).toFixed(2);
        case "min":
          return Math.min(...values).toFixed(2);
        default:
          return "";
      }
    }

    /**
     * Sort table data by a specific column
     */
    sortByColumn(colIndex) {
      const { colIndex: activeCol, direction } = this.sortState;

      let newDirection = "asc";
      if (activeCol === colIndex && direction === "asc") {
        newDirection = "desc";
      } else if (activeCol === colIndex && direction === "desc") {
        newDirection = null;
      }

      this.sortState = {
        colIndex: newDirection ? colIndex : null,
        direction: newDirection,
      };

      if (!newDirection) {
        this.displayData = [...this.processedData];
      } else {
        this.displayData.sort((a, b) => {
          const valA = a[colIndex];
          const valB = b[colIndex];

          if (typeof valA === "number" && typeof valB === "number") {
            return newDirection === "asc" ? valA - valB : valB - valA;
          }

          return newDirection === "asc"
            ? String(valA).localeCompare(String(valB))
            : String(valB).localeCompare(String(valA));
        });
      }

      this.filteredData = [...this.displayData];
      this.refreshTableBody();
    }

    /**
     * refresh table body
     */
    refreshTableBody() {
      const tbody = document.querySelector(`#${this.config.tableID} tbody`);
      if (!tbody) return;

      tbody.innerHTML = this.displayData
        .map(
          (row, rowIndex) => `
      <tr data-row-index="${rowIndex}">
        ${row
          .map(
            (cell, colIndex) => `
          <td data-heading="${this.processedHeadings[colIndex]}">
            ${this.renderCell(cell, rowIndex, colIndex)}
          </td>`
          )
          .join("")}
      </tr>`
        )
        .join("");

      this.updateRowCount();
    }

    /**
     * Generate HTML for the table including download button if configured
     */
    generateHTML(headings, data) {
      const { tableID, downloadConfig } = this.config;

      const topDownloadButtonHTML =
        downloadConfig.enable &&
        (downloadConfig.position === "top-right" ||
          downloadConfig.position === "top-left" ||
          downloadConfig.position === "top-center")
          ? this.generateDownloadButton("top")
          : "";

      const bottomDownloadButtonHTML =
        downloadConfig.enable && downloadConfig.position === "bottom"
          ? this.generateDownloadButton("bottom")
          : "";

      let tableHTML = `
        <div class="table-library-container">
          ${topDownloadButtonHTML}
          <table id="${tableID}">
            <thead>
              <tr>
                ${headings
                  .map(
                    (heading, i) => `
                  <th>
                    <div class="table-header">
                      <span 
                        class="table-heading-text table-sortable" 
                        data-col-index="${i}">
                        ${heading}
                        <span class="sort-icon">⇅</span>
                      </span>
                      ${
                        this.isNumericColumn(i)
                          ? `
                            <select class="table-metric-dropdown" data-col-index="${i}">
                              <option value=""></option>
                              <option value="avg">Avg</option>
                              <option value="sum">Sum</option>
                              <option value="max">Max</option>
                              <option value="min">Min</option>
                            </select>
                          `
                          : ""
                      }
                    </div>

                    <div class="table-metric-result" data-result-col="${i}"></div>
                    <input type="text" placeholder="Filter ${heading}" />
                  </th>
                `
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (row, rowIndex) => `
                <tr data-row-index="${rowIndex}">
                  ${row
                    .map(
                      (cell, colIndex) => `
                    <td data-heading="${headings[colIndex]}">
                      ${this.renderCell(cell, rowIndex, colIndex)}
                    </td>
                  `
                    )
                    .join("")}
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          ${bottomDownloadButtonHTML}
        </div>
      `;

      return tableHTML;
    }

    /**
     * Generate download button HTML based on user configuration
     */
    generateDownloadButton(position) {
      const { downloadConfig } = this.config;
      const {
        buttonText = "Download Table Data",
        buttonClass = "table-library-download-btn",
        customHTML = null,
      } = downloadConfig;

      // If user provides custom HTML, use it
      if (customHTML) {
        return `<div class="table-library-download-container table-library-download-${position}">${customHTML}</div>`;
      }

      // Default download button
      return `
        <div class="table-library-download-container table-library-download-${position}">
          <button class="${buttonClass}" id="${this.config.tableID}-download-${position}">
            ${buttonText}
          </button>
        </div>
      `;
    }

    /**
     * Render individual cell content based on data type
     */
    renderCell(cell, rowIndex, colIndex) {
      if (cell === null || cell === undefined) {
        return '<span class="table-library-null">-</span>';
      }

      if (typeof cell === "object" && cell !== null) {
        if (cell.type === "url") {
          return `<a href="${
            cell.value
          }" target="_blank" class="table-library-url">${
            cell.placeholder || "Open"
          }</a>`;
        }

        if (cell.type === "button") {
          const hasCheckbox = cell.checkbox ? "has-checkbox" : "";
          const checkedAttr = cell.checkboxValue ? "checked" : "";

          return `
            <div class="table-library-action-cell ${hasCheckbox}">
              <button class="table-library-action-btn" 
                      data-fn="${cell.function}" 
                      data-row-index="${rowIndex}">
                ${cell.placeholder || "Action"}
              </button>
              ${
                cell.checkbox
                  ? `
                <label class="table-library-checkbox-label">
                  <input type="checkbox" ${checkedAttr}
                    class="table-library-action-checkbox" 
                    data-row-index="${rowIndex}"
                    data-fn="${cell.function}" />
                  <span>${cell.checkboxLabel || "Mark"}</span>
                </label>
              `
                  : ""
              }
            </div>
          `;
        }

        return `<pre class="table-library-object">${JSON.stringify(
          cell,
          null,
          2
        )}</pre>`;
      }

      if (Array.isArray(cell)) {
        if (cell.length === 0)
          return '<span class="table-library-empty">[]</span>';
        return `<span class="table-library-array" title="${cell.join(
          ", "
        )}">[${cell.join(", ")}]</span>`;
      }

      if (cell instanceof Date && !isNaN(cell.getTime())) {
        return `<span class="table-library-date">${this.formatDateOrTimestamp(
          cell
        )}</span>`;
      }

      if (typeof cell === "boolean") {
        return `<span class="table-library-boolean ${
          cell ? "true" : "false"
        }">${cell ? "Yes" : "No"}</span>`;
      }

      if (typeof cell === "number") {
        return `<span class="table-library-number">${cell}</span>`;
      }

      const text = String(cell);
      return `<span class="table-library-text" title="${text}">${text}</span>`;
    }

    /**
     * Get cell text content for CSV export (uses displayed value)
     */
    getCellTextContent(cell) {
      if (cell === null || cell === undefined) {
        return "";
      }

      if (typeof cell === "object" && cell !== null) {
        if (cell.type === "url") {
          return cell.placeholder || "Open";
        }

        if (cell.type === "button") {
          return cell.placeholder || "Action";
        }

        if (Array.isArray(cell)) {
          return cell.join("; ");
        }

        if (cell instanceof Date && !isNaN(cell.getTime())) {
          return this.formatDateOrTimestamp(cell);
        }

        return JSON.stringify(cell);
      }

      if (typeof cell === "boolean") {
        return cell ? "Yes" : "No";
      }

      return String(cell);
    }

    /**
     * Initialize the table - main entry point
     */
    init() {
      let processed = this.hideColumns(this.config.headings, this.config.data);
      let finalData = this.applyModifications(
        processed.data,
        processed.headings
      );

      this.processedData = finalData;
      this.processedHeadings = processed.headings;
      this.filteredData = [...finalData];
      this.displayData = [...finalData]; // Store the display data

      const container =
        typeof this.config.container === "string"
          ? document.querySelector(this.config.container)
          : this.config.container;

      if (!container) {
        console.error("TableLibrary: Container not found");
        return;
      }

      container.innerHTML = this.generateHTML(processed.headings, finalData);
      this.attachEventListeners();
    }

    /**
     * Attach all event listeners for interactivity
     */
    attachEventListeners() {
      const { tableID } = this.config;

      // Debounce function for performance
      const debounce = (fn, delay) => {
        let timeout;
        return (...args) => {
          clearTimeout(timeout);
          timeout = setTimeout(() => fn(...args), delay);
        };
      };

      // Filter functionality
      const filterTable = () => {
        const inputs = document.querySelectorAll(`#${tableID} thead input`);
        const rows = document.querySelectorAll(`#${tableID} tbody tr`);

        const visibleRowIndexes = [];

        rows.forEach((row, index) => {
          let visible = true;
          inputs.forEach((input, i) => {
            const filter = input.value.trim().toLowerCase();
            if (filter) {
              const text = (row.cells[i]?.textContent || "").toLowerCase();
              if (!text.includes(filter)) visible = false;
            }
          });
          row.style.display = visible ? "" : "none";
          if (visible) visibleRowIndexes.push(index);
        });

        // Update filtered data based on visible rows (using display data)
        this.filteredData = visibleRowIndexes.map(
          (index) => this.displayData[index]
        );

        // Update metric dropdowns
        document.querySelectorAll(".table-metric-dropdown").forEach((dd) => {
          if (dd.value) {
            dd.dispatchEvent(new Event("change"));
          }
        });
      };

      document.querySelectorAll(".table-sortable").forEach((el) => {
        el.addEventListener("click", () => {
          const colIndex = parseInt(el.dataset.colIndex);
          this.sortByColumn(colIndex);

          document.querySelectorAll(".sort-icon").forEach((icon) => {
            icon.textContent = "⇅";
          });

          const icon = el.querySelector(".sort-icon");
          if (this.sortState.direction === "asc") icon.textContent = "↑";
          if (this.sortState.direction === "desc") icon.textContent = "↓";
        });
      });

      // Filter events
      document
        .querySelectorAll(`#${tableID} thead input`)
        .forEach((input) =>
          input.addEventListener("input", debounce(filterTable, 300))
        );

      // Download button events for both top and bottom buttons
      if (this.config.downloadConfig.enable) {
        const topDownloadBtn = document.getElementById(
          `${tableID}-download-top`
        );
        const bottomDownloadBtn = document.getElementById(
          `${tableID}-download-bottom`
        );

        if (topDownloadBtn) {
          topDownloadBtn.addEventListener("click", () =>
            this.downloadTableData()
          );
        }
        if (bottomDownloadBtn) {
          bottomDownloadBtn.addEventListener("click", () =>
            this.downloadTableData()
          );
        }
      }

      // Button click events
      document.querySelectorAll(".table-library-action-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const fnName = btn.dataset.fn;
          const rowIndex = parseInt(btn.dataset.rowIndex);
          const rowData = this.processedData[rowIndex];

          // Visual feedback
          btn.style.transform = "scale(0.95)";
          setTimeout(() => {
            btn.style.transform = "";
          }, 150);

          this.callUserFunction(fnName, rowData, rowIndex);

          // Auto-check the checkbox when button is clicked
          const checkbox = btn
            .closest(".table-library-action-cell")
            ?.querySelector(".table-library-action-checkbox");
          if (checkbox) {
            checkbox.checked = true;
            this.handleCheckboxChange(rowData, rowIndex, true);
          }
        });
      });

      // Checkbox change events
      document
        .querySelectorAll(".table-library-action-checkbox")
        .forEach((cb) => {
          cb.addEventListener("click", (e) => {
            e.stopPropagation();
          });

          cb.addEventListener("change", (e) => {
            const rowIndex = parseInt(cb.dataset.rowIndex);
            const fnName = cb.dataset.fn;
            const rowData = this.processedData[rowIndex];

            this.handleCheckboxChange(rowData, rowIndex, cb.checked);

            if (fnName) {
              this.callUserFunction(
                fnName + "Checkbox",
                rowData,
                rowIndex,
                cb.checked
              );
            }
          });
        });

      // Dropdown change events
      document
        .querySelectorAll(".table-metric-dropdown")
        .forEach((dropdown) => {
          dropdown.addEventListener("change", (e) => {
            const colIndex = parseInt(e.target.dataset.colIndex);
            const metric = e.target.value;

            const resultEl = document.querySelector(
              `.table-metric-result[data-result-col="${colIndex}"]`
            );

            if (!metric) {
              resultEl.textContent = "";
              return;
            }

            const result = this.calculateMetric(colIndex, metric);
            resultEl.textContent = `${metric.toUpperCase()}: ${result}`;
          });
        });
    }

    /**
     * Download table data as CSV
     */
    downloadTableData() {
      const { downloadConfig } = this.config;
      const { filename = "table-data.csv", includeHeaders = true } =
        downloadConfig;

      this.downloadAsCSV(filename, includeHeaders);
    }

    /**
     * Download filtered data as CSV (using displayed values)
     */
    downloadAsCSV(filename, includeHeaders = true) {
      const headers = this.processedHeadings;
      const data = this.filteredData;

      // Convert data to CSV format using displayed values
      let csvContent = "";

      // Add headers
      if (includeHeaders) {
        csvContent += headers.map((header) => `"${header}"`).join(",") + "\n";
      }

      // Add rows using displayed values
      data.forEach((row) => {
        const csvRow = row.map((cell) => {
          // Get the displayed text content (same as shown in table)
          const cellValue = this.getCellTextContent(cell);

          // Escape quotes and convert to string
          const stringValue = String(cellValue).replace(/"/g, '""');
          return `"${stringValue}"`;
        });

        csvContent += csvRow.join(",") + "\n";
      });

      // Create and trigger download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    /**
     * Call user-defined function from global scope
     */
    callUserFunction(fnName, rowData, rowIndex, checkboxState = null) {
      if (typeof window[fnName] === "function") {
        if (checkboxState !== null) {
          window[fnName](rowData, rowIndex, checkboxState);
        } else {
          window[fnName](rowData, rowIndex);
        }
        return true;
      }

      console.warn(`Function ${fnName} not found in global scope`);
      return false;
    }

    /**
     * Handle checkbox visual changes
     */
    handleCheckboxChange(rowData, rowIndex, checked) {
      const row = document.querySelector(`[data-row-index="${rowIndex}"]`);

      if (checked) {
        row.style.backgroundColor = "#e6fffa";
        row.classList.add("table-library-row-checked");
      } else {
        row.style.backgroundColor = "";
        row.classList.remove("table-library-row-checked");
      }
    }

    /**
     * PUBLIC API: Update table with new data
     */
    updateData(newData) {
      this.config.data = newData;
      this.init();
    }

    /**
     * PUBLIC API: Get current table data
     */
    getData() {
      return this.config.data;
    }

    /**
     * PUBLIC API: Get checked rows
     */
    getCheckedRows() {
      const checkedRows = [];
      document
        .querySelectorAll(".table-library-action-checkbox:checked")
        .forEach((cb) => {
          const rowIndex = parseInt(cb.dataset.rowIndex);
          checkedRows.push({
            index: rowIndex,
            data: this.processedData[rowIndex],
          });
        });
      return checkedRows;
    }

    /**
     * PUBLIC API: Get filtered data (data currently visible after search/filter)
     */
    getFilteredData() {
      return this.filteredData;
    }
  }

  /**
   * GLOBAL INITIALIZATION FUNCTION
   */
  global.initTableLibrary = function (config) {
    return new TableLibrary(config);
  };
})(window);
