# Fee Estimation System Documentation

This document explains how the automatic fee calculation system works in the VIHIGA-EDAMS-API.

## 🎯 Overview

The fee estimation system automatically calculates application fees based on:

- **Application Type** (Building Permit, Change of Use, etc.)
- **Parcel Data** (Area, location, zoning category)
- **User Inputs** (Floor area, number of plots, parcel value)
- **Predefined Fee Formulas** (Stored in ApplicationType table)

## 🚀 Quick Start

### 1. Get Fee Estimate Before Application

```bash
GET /api/fee-estimation/estimate?applicationTypeId={id}&parcelId={id}&floorArea=150
```

**Example: Building Permit**

```bash
GET /api/fee-estimation/estimate?applicationTypeId=fdaacf44-9acf-4933-a2a6-37510ab9c3ce&parcelId=17578394-2be8-4d49-8788-b23f5057b8ad&floorArea=150
```

**Response:**

```json
{
  "success": true,
  "message": "Fee estimate calculated successfully",
  "data": {
    "applicationType": {
      "id": "fdaacf44-9acf-4933-a2a6-37510ab9c3ce",
      "name": "Building Permit",
      "code": "BLD",
      "formula": "base_fee + (floor_area * rate)"
    },
    "parcel": {
      "id": "17578394-2be8-4d49-8788-b23f5057b8ad",
      "lrNo": "VHG/10003",
      "area": "250.75",
      "location": "Sabatia, Vihiga County",
      "zoningCategory": "Residential"
    },
    "feeBreakdown": [
      {
        "type": "Base Application Fee",
        "amount": 2000,
        "description": "Fee for processing building permit applications."
      },
      {
        "type": "Floor Area Fee",
        "amount": 15000,
        "description": "150 sq.m × 100 KES/sq.m"
      }
    ],
    "totalAmount": 17000,
    "currency": "KES",
    "calculationDetails": [
      "Base fee: 2000.00 KES",
      "Floor area fee: 150 × 100 = 15000 KES"
    ],
    "isEstimate": true,
    "validUntil": "2025-06-20T13:25:34.190Z"
  }
}
```

### 2. Submit Application with Automatic Fee Creation

```bash
POST /api/applications/{id}/submit
Content-Type: application/json

{
  "additionalData": {
    "floorArea": 150,
    "numberOfPlots": 4,
    "parcelValue": 3000000
  }
}
```

The system will automatically:

1. Calculate fees based on application type and data
2. Create ApplicationFee records
3. Return the application with fee information

## 📋 Available Application Types

| Application Type   | Code | Formula                                   | Required Input          |
| ------------------ | ---- | ----------------------------------------- | ----------------------- |
| Building Permit    | BLD  | `base_fee + (floor_area * rate)`          | `floorArea`             |
| Change of Use      | COU  | `base_fee + (parcel_value * 0.01)`        | `parcelValue`           |
| Development Permit | DEV  | `base_fee + (area * rate)`                | None (uses parcel area) |
| Subdivision        | SUB  | `base_fee + (number_of_plots * plot_fee)` | `numberOfPlots`         |

## 🔧 API Endpoints

### Fee Estimation

- `GET /api/fee-estimation/estimate` - Get fee estimate
- `GET /api/fee-estimation/breakdown` - Get detailed fee breakdown
- `GET /api/fee-estimation/application-types` - Get all application types with formulas
- `GET /api/fee-estimation/examples` - Get calculation examples for all types

### Application Fees

- `GET /api/application-fees` - Get all application fees
- `GET /api/application-fees/paid` - Get paid fees
- `GET /api/application-fees/unpaid` - Get unpaid fees
- `GET /api/application-fees/search?query=status` - Search fees
- `GET /api/application-fees/amount-range?minAmount=1000&maxAmount=5000` - Get fees by amount range
- `GET /api/application-fees/application/{applicationId}` - Get fees for specific application
- `GET /api/application-fees/type/{typeId}` - Get fees by application type

## 💰 Fee Calculation Examples

### Example 1: Building Permit

- **Parcel**: Catherine Wanjiku's land (250.75 sq.m)
- **Floor Area**: 150 sq.m
- **Calculation**: 2000 KES base + (150 × 100 KES) = **17,000 KES total**

### Example 2: Change of Use

- **Parcel**: Brian Otieno's land (800.50 sq.m)
- **Parcel Value**: 3,000,000 KES
- **Calculation**: 3000 KES base + (3M × 1%) = **33,000 KES total**

### Example 3: Development Permit

- **Parcel**: Catherine Wanjiku's land (250.75 sq.m)
- **Calculation**: 2500 KES base + (250.75 × 50 KES) = **15,037.50 KES total**

### Example 4: Subdivision

- **Parcel**: Brian Otieno's land (800.50 sq.m)
- **Plots**: 6 plots
- **Calculation**: 1500 KES base + (6 × 500 KES) = **4,500 KES total**

## 🎯 User Experience Flow

### Step 1: User Selects Parcel and Application Type

1. User browses available parcels
2. User selects an application type
3. System shows required documents and fee formula

### Step 2: User Gets Fee Estimate

1. User provides additional information (floor area, parcel value, etc.)
2. System calculates and displays fee breakdown
3. User can modify inputs to see different scenarios

### Step 3: User Submits Application

1. User submits application with additional data
2. System automatically creates ApplicationFee records
3. User sees total cost and breakdown

### Step 4: Payment Process

1. Each fee component becomes a separate payment item
2. User can pay fees individually or in total
3. System tracks payment status

## 🔧 System Architecture

### Core Components

1. **FeeCalculationService** (`src/services/feeCalculationService.js`)

   - Main service for fee calculations
   - Handles formula parsing and application
   - Creates ApplicationFee records

2. **FeeEstimationController** (`src/controllers/feeEstimationController.js`)

   - API endpoints for fee estimation
   - Handles user requests for fee calculations

3. **ApplicationFeeController** (`src/controllers/applicationFeeController.js`)
   - Manages ApplicationFee records
   - Handles CRUD operations for fees

### Database Models

- **ApplicationType**: Contains fee formulas and required documents
- **Fee**: Stores individual fee components (base fees, rates)
- **FeeType**: Categorizes fees (Application Fee, Processing Fee, etc.)
- **ApplicationFee**: Links fees to applications with calculated amounts
- **FeeStructure**: Provides standalone fee structures

## 🚀 Benefits

1. **No Manual Calculations**: Users don't need to understand complex fee structures
2. **Transparency**: Clear breakdown of how fees are calculated
3. **Consistency**: Same application types always get same fee structure
4. **Flexibility**: Different formulas for different application types
5. **Real-time Estimates**: Users can get estimates before submitting
6. **Automation**: Fees are automatically created when applications are submitted

## 🧪 Testing

Run the test script to verify the system works correctly:

```bash
node test-fee-calculation.js
```

This will test all four application types with sample data and show the calculated fees.

## 🔧 Configuration

### Fee Rates

Currently hardcoded in the service, but can be moved to configuration:

- Building Permit: 100 KES/sq.m
- Development Permit: 50 KES/sq.m
- Subdivision: 500 KES/plot

### Fee Formulas

Stored in the ApplicationType table:

- `base_fee + (floor_area * rate)`
- `base_fee + (parcel_value * 0.01)`
- `base_fee + (area * rate)`
- `base_fee + (number_of_plots * plot_fee)`

## 🐛 Troubleshooting

### Common Issues

1. **"Application type not found"**: Check if the ApplicationType ID exists
2. **"Parcel not found"**: Check if the Parcel ID exists
3. **"Fee calculation failed"**: Check if base fees exist for the application type
4. **"Column does not exist"**: Ensure database models are synced correctly

### Debug Mode

Enable debug logging by setting:

```javascript
console.log("Fee calculation details:", calculationDetails);
```

## 📞 Support

For issues with the fee estimation system:

1. Check the server logs for error messages
2. Verify that all required data exists in the database
3. Test with the provided test script
4. Check API endpoint responses for detailed error messages
