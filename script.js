const targetAmountInput = document.getElementById('targetAmount');
const itemPriceInput = document.getElementById('itemPrice');
const initialConversionInput = document.getElementById('initialConversion');
const finalConversionInput = document.getElementById('finalConversion');

// Target Type Radios
const targetTypeRadios = document.querySelectorAll('input[name="targetType"]'); // Get all radios
const targetAmountGroup = document.getElementById('targetAmount').closest('.input-group');

const salesNeededDisplay = document.getElementById('salesNeeded');
const prospectsNeededDisplay = document.getElementById('prospectsNeeded');
const reachNeededDisplay = document.getElementById('reachNeeded');
const potentialMRRDisplay = document.getElementById('potentialMRR');
const potentialARRDisplay = document.getElementById('potentialARR');
const resultsDiv = document.getElementById('results');
const containerDiv = document.querySelector('.container');

// Flow Diagram Elements
const flowReachDisplay = document.getElementById('flowReach');
const flowProspectsDisplay = document.getElementById('flowProspects');
const flowCustomersDisplay = document.getElementById('flowCustomers');
const flowTargetDisplay = document.getElementById('flowTarget'); // Will update this label based on target type
const flowInitialRateDisplay = document.getElementById('flowInitialRate');
const flowFinalRateDisplay = document.getElementById('flowFinalRate');
const flowDiagramDiv = document.getElementById('flow-diagram');

// Expense Elements
const expenseToggle = document.getElementById('expenseToggle');
const expenseCalculatorDiv = document.getElementById('expense-calculator');
const addExpenseBtn = document.getElementById('add-expense-btn');
const expenseItemsList = document.getElementById('expense-items-list');
const totalExpenseDisplay = document.getElementById('totalExpense');
const netAmountDisplay = document.getElementById('netAmount');

// NEW: Expense Adjustment Toggle Element
const adjustForExpenseToggle = document.getElementById('adjustForExpenseToggle');

// NEW: Churn Elements
const churnToggle = document.getElementById('churnToggle');
const churnInputGroup = document.getElementById('churn-input-group');
const churnRateInput = document.getElementById('churnRate');

// NEW: Net Result Node elements
const netResultNode = document.getElementById('net-result-node');
const flowNetValueDisplay = document.getElementById('flowNetValue'); // Get the span for the value

// Ensure Advanced Feature Element references exist
const advancedToggle = document.getElementById('advancedToggle');
const advancedFeaturesDiv = document.getElementById('advanced-features');
const cacInput = document.getElementById('cacInput');
const ltvDisplay = document.getElementById('ltvDisplay');
const ltvCacRatioDisplay = document.getElementById('ltvCacRatioDisplay');
const paybackPeriodDisplay = document.getElementById('paybackPeriodDisplay');
const cacWarning = document.getElementById('cacWarning'); // NEW: Reference for warning message

// NEW: Help Modal Elements
const helpButton = document.getElementById('helpButton');
const helpModal = document.getElementById('helpModal');
const closeHelpButton = helpModal ? helpModal.querySelector('.close-help-button') : null;

let totalExpenses = 0;

function formatNumber(num) {
    if (!isFinite(num) || isNaN(num)) {
        return "---";
    }
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return new Intl.NumberFormat('en-US').format(Math.round(num));
}

function formatCurrency(num, showDecimals = false) {
    if (!isFinite(num) || isNaN(num)) {
        return "---";
    }
    const options = {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
    };
    return new Intl.NumberFormat('en-US', options).format(num);
}

function calculateExpenses() {
    totalExpenses = 0;
    const expenseInputs = expenseItemsList.querySelectorAll('.expense-item-cost');
    expenseInputs.forEach(input => {
        const cost = parseFloat(input.value);
        if (!isNaN(cost) && cost > 0) {
            totalExpenses += cost;
        }
    });

    totalExpenseDisplay.textContent = formatCurrency(totalExpenses, true);
    calculateNetAmount();
}

function calculateNetAmount(achievedRevenue) {
    const isVisible = expenseToggle.checked;
    let netAmount = 0;

    if (!isVisible) {
        netAmountDisplay.textContent = "N/A";
        if(netResultNode) netResultNode.style.display = 'none'; // Hide flow node too
        // Reset label
        const netAmountLabelElement = netAmountDisplay.closest('p');
        if (netAmountLabelElement && netAmountLabelElement.childNodes.length > 0) {
            if (netAmountLabelElement.childNodes[0].nodeType === Node.TEXT_NODE) {
                netAmountLabelElement.childNodes[0].nodeValue = "Net Amount: ";
            } else {
                netAmountLabelElement.insertBefore(document.createTextNode("Net Amount: "), netAmountLabelElement.firstChild);
            }
        }
        return 0; // Return 0 or NaN? Let's return 0 for consistency
    }

    const selectedTargetType = document.querySelector('input[name="targetType"]:checked').value;
    const isAdjusted = adjustForExpenseToggle.checked;
    let netLabel = "Net Amount (Achieved - Expenses): ";
    if (isFinite(achievedRevenue)) {
        netAmount = achievedRevenue - totalExpenses;
    } else {
        netAmount = -totalExpenses;
    }
    // Adjust label based on context
    if (selectedTargetType === 'MRR') {
        netLabel = isAdjusted ? "Net MRR (Achieved MRR - Expenses): " : "Net MRR (Target MRR - Expenses): ";
        if (!isAdjusted) {
            const targetInputVal = parseFloat(targetAmountInput.value);
            netAmount = (!isNaN(targetInputVal) ? targetInputVal : 0) - totalExpenses;
        }
    } else if (selectedTargetType === 'ARR') {
        netLabel = isAdjusted ? "Net ARR (Achieved ARR - Expenses): " : "Net ARR (Target ARR - Expenses): ";
        if (!isAdjusted) {
            const targetInputVal = parseFloat(targetAmountInput.value);
            netAmount = (!isNaN(targetInputVal) ? targetInputVal : 0) - totalExpenses;
        }
    } else {
        netLabel = isAdjusted ? "Net Amount (Achieved Total - Expenses): " : "Net Amount (Target Total - Expenses): ";
        if (!isAdjusted) {
            const targetInputVal = parseFloat(targetAmountInput.value);
            netAmount = (!isNaN(targetInputVal) ? targetInputVal : 0) - totalExpenses;
        }
    }

    // Update summary display
    const netAmountLabelElement = netAmountDisplay.closest('p');
    if (netAmountLabelElement && netAmountLabelElement.childNodes.length > 0) {
        if (netAmountLabelElement.childNodes[0].nodeType === Node.TEXT_NODE) {
            netAmountLabelElement.childNodes[0].nodeValue = netLabel;
        } else {
            netAmountLabelElement.insertBefore(document.createTextNode(netLabel), netAmountLabelElement.firstChild);
            // Remove potential old span if it exists and isn't the one we want
            if (netAmountLabelElement.childNodes.length > 2 && netAmountLabelElement.childNodes[1].nodeName !== 'SPAN') {
                netAmountLabelElement.removeChild(netAmountLabelElement.childNodes[1]);
            }
        }
    }
    netAmountDisplay.textContent = formatCurrency(netAmount, true);

    // Update and show/hide the Net Result flow node
    if (netResultNode && flowNetValueDisplay) {
        flowNetValueDisplay.textContent = formatCurrency(netAmount, true); // Use decimal version here?
        netResultNode.style.display = 'flex'; // Show the node (use flex as it contains arrow+step)
    } else if (netResultNode) {
        netResultNode.style.display = 'none'; // Hide if elements not found (shouldn't happen)
    }
    
    return netAmount; // Return calculated amount
}

function addExpenseItem(defaultName = '', defaultCost = '') {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('expense-item');

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Expense Name (e.g., Ads)';
    nameInput.classList.add('expense-item-name');
    nameInput.value = defaultName; // Set default name

    const costInput = document.createElement('input');
    costInput.type = 'number';
    costInput.placeholder = 'Cost ($/mo)'; // Indicate monthly assumption
    costInput.step = '0.01';
    costInput.min = '0';
    costInput.classList.add('expense-item-cost');
    costInput.value = defaultCost; // Set default cost
    costInput.addEventListener('input', () => {
        calculatePath(); // Recalculate the whole path
    });

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'X';
    removeBtn.classList.add('remove-expense-btn');
    removeBtn.title = 'Remove Expense';
    removeBtn.addEventListener('click', () => {
        itemDiv.remove();
        calculatePath(); // Recalculate the whole path
    });

    itemDiv.appendChild(nameInput);
    itemDiv.appendChild(costInput);
    itemDiv.appendChild(removeBtn);
    expenseItemsList.appendChild(itemDiv);

    // If adding default items, don't focus. Otherwise, focus the name.
    if (!defaultName && !defaultCost) {
        nameInput.focus();
    }
}

function updateTargetTooltip() {
    if (!targetAmountGroup) return; // Guard clause

    const selectedType = document.querySelector('input[name="targetType"]:checked').value;
    let tooltipText = '';

    if (selectedType === 'Amount') {
        tooltipText = 'What is the total amount you want to earn?';
    } else if (selectedType === 'MRR') {
        tooltipText = 'How much recurring revenue do you want to earn each month?';
    } else { // Assuming ARR is the only other option
        tooltipText = 'How much recurring revenue do you want to earn each year?';
    }
    targetAmountGroup.title = tooltipText;
}

function calculatePath() {
    const targetInputVal = parseFloat(targetAmountInput.value);
    const itemPrice = parseFloat(itemPriceInput.value);
    const initialConversionPercent = parseFloat(initialConversionInput.value);
    const finalConversionPercent = parseFloat(finalConversionInput.value);
    const selectedTargetType = document.querySelector('input[name="targetType"]:checked').value;
    const expensesEnabled = expenseToggle.checked;
    const adjustForExpenses = expensesEnabled && adjustForExpenseToggle.checked;
    const churnEnabled = churnToggle.checked;
    const monthlyChurnRate = churnEnabled ? (parseFloat(churnRateInput.value) / 100) : 0;
    const isValidChurn = churnEnabled ? (!isNaN(monthlyChurnRate) && monthlyChurnRate >= 0 && monthlyChurnRate < 1) : true;
    const initialConversion = initialConversionPercent / 100;
    const finalConversion = finalConversionPercent / 100;

    // Input Validation
    const isValidBase = !isNaN(targetInputVal) && targetInputVal > 0 &&
                        !isNaN(itemPrice) && itemPrice > 0 &&
                        !isNaN(initialConversion) && initialConversion > 0 && initialConversion <= 1 &&
                        !isNaN(finalConversion) && finalConversion > 0 && finalConversion <= 1 &&
                        isValidChurn; // Add churn validity check

    // Clear previous states
    containerDiv.classList.remove('results-error');
    // Make MRR/ARR displays visible by default, content will be set later
    potentialMRRDisplay.style.display = 'block';
    potentialARRDisplay.style.display = 'block';

    if (!isValidBase) {
        salesNeededDisplay.textContent = 'Please enter valid positive numbers for all fields (percentages between 0.01 and 100).';
        prospectsNeededDisplay.textContent = '';
        reachNeededDisplay.textContent = '';
        potentialMRRDisplay.textContent = '';
        potentialARRDisplay.textContent = '';

        containerDiv.classList.add('results-error');

        // Clear flow diagram
        flowReachDisplay.textContent = '---';
        flowProspectsDisplay.textContent = '---';
        flowCustomersDisplay.textContent = '---';
        flowTargetDisplay.textContent = '---';
         // Safely try to reset label
        const flowTargetLabelElement = document.getElementById('flowTarget')?.previousElementSibling;
        if (flowTargetLabelElement) flowTargetLabelElement.textContent = "Target Met";
        flowInitialRateDisplay.textContent = '--';
        flowFinalRateDisplay.textContent = '--';

        calculateExpenses(); // Update expense display even on error
        return;
    }

    // Calculate current total expenses (same as before)
    calculateExpenses();

    // Determine Effective Target (if adjusting) (same as before)
    let effectiveTarget = targetInputVal;
    let adjustmentReason = ""; // To append to goal text

    // Adjust for Expenses
    if (isValidBase && adjustForExpenses) {
        adjustmentReason = " (inc. expenses";
        if (selectedTargetType === 'Amount') {
            effectiveTarget = targetInputVal + totalExpenses;
        } else if (selectedTargetType === 'MRR') {
            effectiveTarget = targetInputVal + totalExpenses;
        } else { // ARR
            effectiveTarget = targetInputVal + (totalExpenses * 12);
        }
        if (effectiveTarget < 0) effectiveTarget = 0;
    }

    // Adjust for Churn (applies only to MRR/ARR targets)
    if (isValidBase && churnEnabled && (selectedTargetType === 'MRR' || selectedTargetType === 'ARR')) {
        if (!isValidChurn) {
             // Should be caught by isValidBase, but double-check
        } else {
            // Avoid division by zero or near-zero
            if (1 - monthlyChurnRate > 0.0001) { // Check if denominator is reasonably > 0
                 effectiveTarget = effectiveTarget / (1 - monthlyChurnRate);
                 adjustmentReason += (adjustmentReason ? ", churn" : " (inc. churn"); // Append churn reason
            } else {
                 // Handle impossible situation (100% churn or invalid rate)
                 // Maybe set effectiveTarget to Infinity or handle as error? For now, let it be very large.
                 effectiveTarget = Infinity; 
                 // We should ideally show an error state more clearly here.
            }
        }
        if (effectiveTarget < 0) effectiveTarget = 0; // Recalc check after churn
    }
     if (adjustmentReason) adjustmentReason += ")"; // Close parenthesis if any adjustment happened

    // Core Path Calculations (use effectiveTarget if adjusting, targetInputVal otherwise for display base)
    // Determine the target value used for calculations based on adjustment state
    const calculationTarget = (adjustForExpenses || (churnEnabled && selectedTargetType !== 'Amount')) ? effectiveTarget : targetInputVal;

    let salesNeeded = 0;
    let calculatedMonthlyRevenue = 0;
    let displayTargetValue = targetInputVal; // For the MRR/ARR lines and Goal text baseline
    let flowTargetDisplayValue = calculationTarget; // Value shown in the flow diagram bubble
    let goalDescriptionBase = ""; // Describes the original goal
    let flowTargetLabel = "Target Met";
    let achievedRevenueForPeriod = NaN;
    let timeQualifier = ""; // NEW: For path description

    if (selectedTargetType === 'Amount') {
        salesNeeded = calculationTarget / itemPrice;
        achievedRevenueForPeriod = salesNeeded * itemPrice;
        goalDescriptionBase = `Earn ${formatCurrency(targetInputVal)} total`; // Original goal
        flowTargetLabel = adjustForExpenses ? "Adjusted Target" : "Total Target";
        flowTargetDisplayValue = achievedRevenueForPeriod; // Show the calculated total goal in flow
        timeQualifier = "total"; // Set time qualifier
        potentialMRRDisplay.textContent = `(Implied MRR N/A for Total Target)`;
        potentialARRDisplay.textContent = `(Implied ARR N/A for Total Target)`;

    } else if (selectedTargetType === 'MRR') {
        salesNeeded = calculationTarget / itemPrice;
        calculatedMonthlyRevenue = salesNeeded * itemPrice;
        achievedRevenueForPeriod = calculatedMonthlyRevenue;
        displayTargetValue = targetInputVal; // Original target
        goalDescriptionBase = `Achieve ${formatCurrency(targetInputVal)} MRR`;
        flowTargetLabel = (adjustForExpenses || churnEnabled) ? "Adjusted MRR" : "Target MRR";
        flowTargetDisplayValue = calculatedMonthlyRevenue; // Show the calculated MRR goal in flow
        timeQualifier = "per month"; // Set time qualifier
        potentialMRRDisplay.textContent = `Target MRR: ${formatCurrency(targetInputVal)}`;
        potentialARRDisplay.textContent = `Equivalent ARR: ${formatCurrency(targetInputVal * 12)}`;

    } else { // ARR
        const monthlyCalculationTarget = calculationTarget / 12;
        salesNeeded = monthlyCalculationTarget / itemPrice;
        calculatedMonthlyRevenue = salesNeeded * itemPrice;
        achievedRevenueForPeriod = calculatedMonthlyRevenue * 12;
        displayTargetValue = targetInputVal; // Original target
        goalDescriptionBase = `Achieve ${formatCurrency(targetInputVal)} ARR`;
        flowTargetLabel = (adjustForExpenses || churnEnabled) ? "Adjusted ARR" : "Target ARR";
        flowTargetDisplayValue = achievedRevenueForPeriod; // Show the calculated ARR goal in flow
        timeQualifier = "per month"; // Set time qualifier
        potentialMRRDisplay.textContent = `Equivalent MRR: ${formatCurrency(targetInputVal / 12)}`;
        potentialARRDisplay.textContent = `Target ARR: ${formatCurrency(targetInputVal)}`;
    }

    const prospectsNeeded = salesNeeded / finalConversion;
    const reachNeeded = prospectsNeeded / initialConversion;

    // Goal text now reflects the *target* (original or adjusted based on toggle)
    let displayedGoalValue = (adjustForExpenses || (churnEnabled && selectedTargetType !== 'Amount')) ? effectiveTarget : targetInputVal;
    // Ensure correct period for goal description value
    if (selectedTargetType === 'ARR' && !adjustForExpenses) displayedGoalValue = targetInputVal;
    if (selectedTargetType === 'ARR' && adjustForExpenses) displayedGoalValue = effectiveTarget;
    if (selectedTargetType === 'MRR' && !adjustForExpenses) displayedGoalValue = targetInputVal;
    if (selectedTargetType === 'MRR' && adjustForExpenses) displayedGoalValue = effectiveTarget;
    
    let dynamicGoalDescription = ``;
    if (selectedTargetType === 'Amount') dynamicGoalDescription = `Earn ${formatCurrency(displayedGoalValue)} total`;
    if (selectedTargetType === 'MRR') dynamicGoalDescription = `Achieve ${formatCurrency(displayedGoalValue)} MRR`;
    if (selectedTargetType === 'ARR') dynamicGoalDescription = `Achieve ${formatCurrency(displayedGoalValue)} ARR`;


    salesNeededDisplay.textContent = `1. Goal: ${dynamicGoalDescription} by selling units at ${formatCurrency(itemPrice)} each.${adjustmentReason}`;
    prospectsNeededDisplay.textContent = `2. Strategy: Reach ${formatNumber(reachNeeded)} people ${timeQualifier} to get ${formatNumber(prospectsNeeded)} free users (at ${initialConversionPercent}% initial interest).`;
    const customerNoun = (selectedTargetType === 'Amount') ? "customers total" : "customers per month";
    reachNeededDisplay.textContent = `3. Outcome: Convert ${formatNumber(salesNeeded)} ${customerNoun} ${timeQualifier} from free users (at ${finalConversionPercent}% conversion) to meet the goal.`;

    // Flow Diagram uses adjusted numbers
    flowReachDisplay.textContent = formatNumber(reachNeeded);
    flowProspectsDisplay.textContent = formatNumber(prospectsNeeded);
    flowCustomersDisplay.textContent = formatNumber(salesNeeded);
    const flowTargetLabelElement = document.getElementById('flowTarget')?.previousElementSibling;
    if (flowTargetLabelElement) flowTargetLabelElement.textContent = flowTargetLabel;
    // Display the target value consistent with the calculations (effective or original)
    flowTargetDisplay.textContent = formatCurrency(flowTargetDisplayValue);
    flowInitialRateDisplay.textContent = initialConversionPercent;
    flowFinalRateDisplay.textContent = finalConversionPercent;

    // 8. Calculate and Update ADVANCED Metrics (only if enabled)
    if (advancedToggle && advancedFeaturesDiv) {
        // --- DEBUGGING LOGS --- 
        console.log("--- Advanced Metrics Debug ---");
        console.log("Advanced Enabled:", advancedToggle.checked);
        console.log("Churn Enabled:", churnEnabled);
        console.log("Is Valid Churn Logic:", isValidChurn);
        console.log("Monthly Churn Rate (Decimal):", monthlyChurnRate);
        console.log("Item Price:", itemPrice);
        console.log("CAC Parsed Value:", cacInput.value);
        console.log("Is Valid CAC Logic:", cacInput.value > 0);
        // --- END DEBUGGING --- 
        
        let ltv = NaN;
        let ltvCacRatio = NaN;
        let paybackMonths = NaN;
        let showWarning = false;
        let warningTitle = "";

        // Calculate LTV 
        if (churnEnabled && isValidChurn && itemPrice > 0) {
            if (monthlyChurnRate > 0) {
                 ltv = itemPrice / monthlyChurnRate;
            } else if (monthlyChurnRate === 0) {
                 ltv = Infinity; 
            }
        }
        console.log("Calculated LTV:", ltv); // Log calculated LTV
        
        // Check for Warning Condition (Use cac and isValidCAC)
        if (isFinite(ltv) && ltv > 0 && cacInput.value > 0 && cacInput.value > ltv) {
            showWarning = true;
            warningTitle = "This suggests you might be spending more to acquire a customer than they are worth over their lifetime, which is generally unsustainable.";
        }

        // Calculate LTV/CAC Ratio (Use cac and isValidCAC)
        if (isFinite(ltv) && ltv > 0 && cacInput.value > 0) {
            ltvCacRatio = ltv / cacInput.value;
        }

        // Calculate Payback Period (Use cac and isValidCAC)
        if (cacInput.value >= 0 && itemPrice > 0) {
            paybackMonths = cacInput.value / itemPrice;
        }

        // Update Metric Displays
        ltvDisplay.textContent = isFinite(ltv) ? formatCurrency(ltv) : (ltv === Infinity ? 'Infinite (0% Churn)' : 'N/A');
        ltvCacRatioDisplay.textContent = !isNaN(ltvCacRatio) ? ltvCacRatio.toFixed(1) : 'N/A';
        paybackPeriodDisplay.textContent = !isNaN(paybackMonths) ? `${paybackMonths.toFixed(1)} Months` : 'N/A';

        // Update Warning Display
        if (cacWarning) { 
            if (showWarning) {
                cacWarning.textContent = "Warning: CAC > LTV";
                cacWarning.title = warningTitle;
                cacWarning.style.display = 'block';
            } else {
                cacWarning.style.display = 'none';
                cacWarning.textContent = "";
                cacWarning.title = "";
            }
        }

    } else {
         // Ensure advanced metrics AND warning are cleared if toggle is off
         ltvDisplay.textContent = 'N/A';
         ltvCacRatioDisplay.textContent = 'N/A';
         paybackPeriodDisplay.textContent = 'N/A';
         if (cacWarning) {
             cacWarning.style.display = 'none';
             cacWarning.textContent = "";
             cacWarning.title = "";
         }
    }

    // Calculate Net Amount and update its display (including the flow node)
    calculateNetAmount(achievedRevenueForPeriod);
}

// --- Event Listeners ---

// Calculate path on main input change
[targetAmountInput, itemPriceInput, initialConversionInput, finalConversionInput].forEach(input => {
    input.addEventListener('input', calculatePath);
});

// Calculate path when target type changes
targetTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        updateTargetTooltip(); // Update the tooltip
        calculatePath();       // Recalculate the path
    });
});

// Expense Toggle Listener
expenseToggle.addEventListener('change', () => {
    const isChecked = expenseToggle.checked;
    expenseCalculatorDiv.style.display = isChecked ? 'block' : 'none';

    // If turning on AND the list is empty, add defaults
    if (isChecked && expenseItemsList.children.length === 0) {
        addExpenseItem('Product Building Cost', ''); // Add with empty cost initially
        addExpenseItem('Marketing Cost', '');
    }

    // Always recalculate path when toggle changes (affects expense visibility/adjustment)
    calculatePath();
});

// NEW: Listener for the Adjust for Expenses toggle
adjustForExpenseToggle.addEventListener('change', calculatePath);

// Add Expense Button Listener
addExpenseBtn.addEventListener('click', () => addExpenseItem()); // Use default empty values

// NEW: Churn Toggle Listener
churnToggle.addEventListener('change', () => {
    churnInputGroup.style.display = churnToggle.checked ? 'block' : 'none';
    calculatePath(); // Recalculate when churn is toggled
});

// NEW: Churn Rate Input Listener
churnRateInput.addEventListener('input', calculatePath);

// Ensure Advanced Toggle Listener exists and is correct
if (advancedToggle && advancedFeaturesDiv) { // Add checks for element existence
    advancedToggle.addEventListener('change', () => {
        advancedFeaturesDiv.style.display = advancedToggle.checked ? 'block' : 'none';
        calculatePath(); // Recalculate when advanced view is toggled
    });
} else {
    console.error("Advanced toggle elements not found!");
}

// Ensure CAC Input Listener exists
if(cacInput) {
    cacInput.addEventListener('input', calculatePath);
} else {
     console.error("CAC input element not found!");
}

// NEW: Help Modal Listeners
if (helpButton && helpModal && closeHelpButton) {
    helpButton.addEventListener('click', () => {
        helpModal.style.display = 'block'; // Or 'flex' if using flex for centering
    });

    closeHelpButton.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });

    // Optional: Close when clicking outside the modal content
    helpModal.addEventListener('click', (event) => {
        if (event.target === helpModal) { // Check if the click is on the overlay itself
            helpModal.style.display = 'none';
        }
    });
} else {
    console.error("Help modal elements not found!");
}

// --- Initial Load ---
expenseCalculatorDiv.style.display = expenseToggle.checked ? 'block' : 'none';
// Add default expenses on initial load if toggle is checked and list is empty
if (expenseToggle.checked && expenseItemsList.children.length === 0) {
    addExpenseItem('Product Building Cost', '');
    addExpenseItem('Marketing Cost', '');
}
// Ensure net result node is hidden initially unless expenses are somehow on by default
if (netResultNode) {
   netResultNode.style.display = expenseToggle.checked ? 'flex' : 'none';
}
updateTargetTooltip(); // Set initial tooltip based on default checked radio

// Ensure Initial Load logic for Advanced section exists
if (advancedToggle && advancedFeaturesDiv) { // Add checks
    advancedFeaturesDiv.style.display = advancedToggle.checked ? 'block' : 'none';
} else {
    console.error("Cannot set initial display for Advanced Features - elements not found.");
}

calculatePath(); // Initial calculation 