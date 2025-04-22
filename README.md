# Funnel Estimator

A simple calculator to visualize the path to your financial targets by estimating key funnel metrics (Reach -> Users -> Customers) and factoring in optional expenses and churn.

## Overview

This tool helps entrepreneurs, SaaS builders, and digital product owners estimate the effort required to reach specific financial goals (Total Amount, MRR, or ARR). It calculates the necessary reach, user acquisition, and customer conversion based on your inputs and visualizes the path.

## Features

*   **Goal Types:** Set targets for Total Amount, Monthly Recurring Revenue (MRR), or Annual Recurring Revenue (ARR).
*   **Funnel Calculation:** Estimates required Reach/Leads, Free Users/Prospects, and Paying Customers based on conversion rates.
*   **Expense Tracking:** Add estimated monthly expenses and see their impact on the net result.
*   **Goal Adjustment:** Optionally increase the required funnel metrics to meet your target *after* accounting for expenses and/or churn.
*   **Churn Calculation:** Factor in monthly customer churn rate for MRR/ARR goals.
*   **Advanced SaaS Metrics (Beta):** Estimate Customer Lifetime Value (LTV), LTV/CAC Ratio, and CAC Payback Period (requires CAC input and Churn enabled for LTV).
*   **Visualization:** Includes a flow diagram showing the steps and numbers required.
*   **Tooltips & Help:** Detailed explanations available via tooltips and an in-app manual.

## How to Use

1.  Open the `index.html` file in your web browser.
2.  **Enter Inputs (Left Panel):**
    *   Set your `Target ($)` amount and select the type (Total Amount, MRR, ARR).
    *   Enter your `Item Price ($)`.
    *   Enter your estimated `Initial Interest Rate (%)` (Reach to Free User).
    *   Enter your estimated `Customer Conversion Rate (%)` (Free User to Customer).
3.  **Optional Features (Left Panel):**
    *   Toggle `Calculate Monthly Churn?` and enter a rate if applicable (for MRR/ARR).
    *   Toggle `Calculate Expenses?`, add expense items/costs, and optionally toggle `Adjust Plan for Expenses?`.
    *   Toggle `Show Advanced SaaS Metrics?` and enter your estimated `Average Customer Acquisition Cost (CAC) ($)`.
4.  **View Results (Right Panel):**
    *   See the step-by-step `Your Path (Calculations)`.
    *   See the visual `Your Path (Flow)` diagram.
    *   If Advanced Metrics are enabled, view the calculated LTV, Ratio, and Payback Period.

## Technologies

*   HTML
*   CSS
*   JavaScript (Vanilla)

## Author

*   [RTBRuhan](https://rtbruhan.github.io)
