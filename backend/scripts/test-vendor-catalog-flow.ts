/**
 * Ringers Backend - Vendor Management & Catalog Module Verification Suite
 * Tests slug generation, validation schemas, price constraints, and route configuration.
 */
import { slugify } from '../src/utils/slug.js';
import {
  updateVendorProfileSchema,
  updateVendorStatusSchema,
  createVendorAddressSchema,
  addVendorStaffSchema,
} from '../src/modules/vendors/vendor.validation.js';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../src/modules/products/category.validation.js';
import {
  createProductSchema,
  updateProductSchema,
  createProductVariantSchema,
  addProductImageSchema,
} from '../src/modules/products/product.validation.js';
import { createApp } from '../src/app.js';

async function runTests() {
  console.log('🧪 Starting Ringers Phase 3 Vendor & Catalog Verification...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Slug Utility
  console.log('1. Slug Utility');
  assert(slugify("Mario's Italian Pizza & Pasta") === 'marios-italian-pizza-and-pasta', 'Slugifies business / product names properly');
  assert(slugify('Special @ Discount -- Burger!') === 'special-discount-burger', 'Strips unwanted special characters');

  // 2. Vendor Validation Schemas
  console.log('\n2. Vendor Validation Schemas');
  const validVendorProfile = updateVendorProfileSchema.safeParse({
    body: {
      businessName: "Luigi's Pizzeria",
      description: 'Authentic stone-baked pizzas and Italian desserts',
      phone: '+919876543210',
      email: 'luigi@pizzeria.com',
    },
  });
  assert(validVendorProfile.success, 'Valid vendor profile update payload passes');

  const invalidPhoneVendor = updateVendorProfileSchema.safeParse({
    body: { phone: 'not-a-phone-number' },
  });
  assert(!invalidPhoneVendor.success, 'Invalid phone number format is rejected');

  const validStatus = updateVendorStatusSchema.safeParse({
    body: { status: 'ACTIVE' },
  });
  assert(validStatus.success, 'Valid status (ACTIVE) passes');

  const invalidStatus = updateVendorStatusSchema.safeParse({
    body: { status: 'RANDOM_STATUS' },
  });
  assert(!invalidStatus.success, 'Invalid status is rejected');

  const validAddress = createVendorAddressSchema.safeParse({
    body: {
      addressLine1: 'Shop 14, High Street Mall',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      latitude: 18.5204,
      longitude: 73.8567,
      isPrimary: true,
    },
  });
  assert(validAddress.success, 'Valid storefront address payload passes');

  const validStaff = addVendorStaffSchema.safeParse({
    body: {
      userId: '11111111-2222-3333-4444-555555555555',
      designation: 'CHEF',
    },
  });
  assert(validStaff.success, 'Valid staff assignment passes');

  // 3. Category Validation Schemas
  console.log('\n3. Category Validation Schemas');
  const validCategory = createCategorySchema.safeParse({
    body: {
      name: 'Wood-Fired Pizza',
      description: 'Traditional wood-fired pizzas',
      status: 'ACTIVE',
    },
  });
  assert(validCategory.success, 'Valid category creation payload passes');

  const shortCategoryName = createCategorySchema.safeParse({
    body: { name: 'P' },
  });
  assert(!shortCategoryName.success, 'Category name shorter than 2 chars is rejected');

  // 4. Product & Variant Validation Schemas
  console.log('\n4. Product & Variant Validation Schemas');
  const validProduct = createProductSchema.safeParse({
    body: {
      name: 'Margherita Supreme',
      sku: 'PIZZA-MARG-001',
      price: 399.0,
      discountPrice: 349.0,
      taxRate: 5.0,
      status: 'AVAILABLE',
      variants: [
        { name: 'Regular 8"', sku: 'PIZZA-MARG-REG', price: 349.0, status: 'AVAILABLE' },
        { name: 'Large 12"', sku: 'PIZZA-MARG-LRG', price: 549.0, status: 'AVAILABLE' },
      ],
      images: [
        { imageUrl: 'https://images.ringers.com/pizzas/margherita.jpg', sortOrder: 0, isPrimary: true },
      ],
    },
  });
  assert(validProduct.success, 'Complete product with variants and images passes');

  const invalidDiscountProduct = createProductSchema.safeParse({
    body: {
      name: 'Margherita Supreme',
      sku: 'PIZZA-MARG-002',
      price: 300.0,
      discountPrice: 450.0, // Invalid: discount price cannot exceed base price!
    },
  });
  assert(!invalidDiscountProduct.success, 'Rejects discount price greater than regular price');

  const negativePriceProduct = createProductSchema.safeParse({
    body: {
      name: 'Invalid Product',
      sku: 'NEG-001',
      price: -50.0,
    },
  });
  assert(!negativePriceProduct.success, 'Rejects negative product price');

  const validVariant = createProductVariantSchema.safeParse({
    body: {
      name: 'Extra Cheese Variant',
      sku: 'VAR-CHEESE-01',
      price: 75.0,
      status: 'AVAILABLE',
    },
  });
  assert(validVariant.success, 'Valid standalone variant passes');

  const validImage = addProductImageSchema.safeParse({
    body: {
      imageUrl: 'https://cdn.ringers.com/products/burger.png',
      sortOrder: 1,
      isPrimary: true,
    },
  });
  assert(validImage.success, 'Valid image payload passes');

  // 5. Express App Setup & Routes
  console.log('\n5. Express Application & Route Mounting');
  const app = createApp();
  assert(typeof app === 'function', 'Express application factory compiles and returns app');

  console.log('\n================================');
  console.log(`Tests Run: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
