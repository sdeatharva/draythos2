# Draythos Excel Add-in (Office.js)

**Specification:** Section 14.2 & Milestone P1  
**Compatibility:** Microsoft Excel 2016+, Excel for Microsoft 365, Excel on the Web  

---

## Capabilities

1. **Normalize Selection:** Select any block of financial headers (e.g., `Turnover`, `Net Sales`, `Revenue from Operations`, `VAT`, `GST`) in an active Excel spreadsheet, click **Normalize Selection**, and watch Draythos insert canonical concept labels, concept IDs, and confidence percentages in adjacent columns.
2. **Pull Facts:** Query the Draythos `facts` system of record by concept ID (`fs.revenue`, `tax.value_added`, etc.) and period, inserting numeric values along with source citations.
3. **Deep-Link to Eyrie:** Jump directly to the Review UI with filtered views and document locators.

---

## Local Sideloading Instructions

1. **Serve the Add-in:**
   ```bash
   npx serve excel-addin -p 3001 --ssl
   ```
2. **Sideload in Excel:**
   - In Excel on Windows: Go to **Insert** > **My Add-ins** > **Add a Custom Add-in** > **Upload My Add-in** and select `excel-addin/manifest.xml`.
   - Alternatively, copy `manifest.xml` to `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef\`.
3. **Connect to Vhagar:**
   Ensure Vhagar is running on `http://localhost:8001` (or `http://localhost:8000`).

