const TOPICS = [
  {
    title: "Environment Setup",
    subtitle: "Install Git, Node 20 LTS, and dependencies.",
    slide: "Setup",
    overview:
      "Use the exact Node version to avoid Hardhat/toolbox incompatibilities.",
    bullets: [
      "Node.js 20 LTS required",
      "Commands must be run inside the cloned repo folder",
      "Run npm install before tests",
      "WSL users: run nvm use 20 in each terminal",
    ],
    commands: [
      "git --version",
      "node --version",
      "npm --version",
      "nvm use 20    # or install Node 20 LTS",
    ],
  },
  {
    title: "Repo Layout",
    subtitle: "Student vs complete references.",
    slide: "Setup",
    overview:
      "The repository mirrors the slide sequence. You implement TODOs and write tests, then compare with complete versions.",
    bullets: [
      "Student contract: contracts/FactoringContract.sol",
      "Complete contract: contracts/FactoringContract.complete.sol",
      "Student tests: test/FactoringContract.test.js",
      "Complete tests: test-complete/FactoringContract.test.js",
    ],
    commands: [
      "git clone https://github.com/hedgeyos/blocksphere-nobleprog-blockchain",
      "cd blocksphere-nobleprog-blockchain",
      "npm install",
    ],
  },
  {
    title: "Lab Overview",
    subtitle: "What you will build in this session.",
    slide: "Slide 33",
    overview:
      "You will complete a factoring smart contract, write tests, and deploy locally. The repo is structured to mirror slides, with student and complete versions.",
    bullets: [
      "Student contract: contracts/FactoringContract.sol",
      "Complete contract: contracts/FactoringContract.complete.sol",
      "Student tests: test/FactoringContract.test.js",
      "Complete tests: test-complete/FactoringContract.test.js",
    ],
    commands: [
      "git checkout checkpoint-33-start",
      "npm install",
      "npm test    # expect failures until TODOs are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
  },
  {
    title: "Remaining Functions",
    subtitle: "Identify the missing pieces first.",
    slide: "Slide 34",
    overview:
      "The student contract includes TODOs. These functions implement the invoice lifecycle and access control.",
    bullets: [
      "requestEarlyPayment()",
      "fund() with ETH transfer",
      "settlePayment()",
      "Admin functions",
    ],
    commands: [
      "git checkout checkpoint-33-start",
      "npm test    # expect failures until TODOs are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
  },
  {
    title: "requestEarlyPayment",
    subtitle: "Supplier asks for financing after approval.",
    slide: "Slide 35",
    overview:
      "Only the supplier can request early payment, and only after the buyer has approved the invoice.",
    commands: [
      "git checkout checkpoint-35-requestEarlyPayment",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    studentTodo: "Implement in contracts/FactoringContract.sol",
    studentCode: `// Student version (TODO)
function requestEarlyPayment(uint256 _invoiceId)
    external
    onlySupplier(_invoiceId)
    inStatus(_invoiceId, InvoiceStatus.Approved)
{
    revert("TODO: requestEarlyPayment");
}`,
    referenceCode: `function requestEarlyPayment(uint256 _invoiceId)
    external
    onlySupplier(_invoiceId)
    inStatus(_invoiceId, InvoiceStatus.Approved)
{
    invoices[_invoiceId].status = InvoiceStatus.FinancingRequested;
    emit FinancingRequested(_invoiceId, msg.sender);
}`,
    notes: [
      "Enforces role (supplier) and correct status (Approved).",
      "Moves the invoice into FinancingRequested state.",
      "Emits an event for off-chain listeners.",
    ],
  },
  {
    title: "Handling ETH Transfers",
    subtitle: "Use the safe send pattern.",
    slide: "Slide 36",
    overview:
      "When receiving and sending ETH, verify msg.value and use low-level call with checks.",
    commands: [
      "git checkout checkpoint-35-requestEarlyPayment",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    referenceCode: `require(msg.value >= amountRequired, "Insufficient funds");

(bool ok, ) = payable(recipient).call{value: amountRequired}("");
require(ok, "Transfer failed");`,
    notes: [
      "payable allows a function to receive ETH.",
      "msg.value is the amount sent with the transaction.",
      "Always check the transfer result.",
    ],
  },
  {
    title: "fund()",
    subtitle: "Financier funds the invoice.",
    slide: "Slide 37",
    overview:
      "The financier sends ETH and receives a future repayment when the buyer settles.",
    commands: [
      "git checkout checkpoint-37-fund",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    studentTodo: "Implement in contracts/FactoringContract.sol",
    studentCode: `// Student version (TODO)
function fund(uint256 _invoiceId)
    external
    payable
    inStatus(_invoiceId, InvoiceStatus.FinancingRequested)
{
    revert("TODO: fund");
}`,
    referenceCode: `function fund(uint256 _invoiceId)
    external
    payable
    inStatus(_invoiceId, InvoiceStatus.FinancingRequested)
{
    Invoice storage invoice = invoices[_invoiceId];
    uint256 discountedAmount = calculateDiscount(invoice.amount);
    require(msg.value >= discountedAmount, "Insufficient funds");

    invoice.status = InvoiceStatus.Funded;
    invoice.financier = msg.sender;

    (bool ok, ) = payable(invoice.supplier).call{value: discountedAmount}("");
    require(ok, "Transfer failed");

    emit InvoiceFunded(_invoiceId, msg.sender);
}`,
    notes: [
      "Requires the invoice to be FinancingRequested.",
      "Transfers discounted amount to supplier.",
      "Records the financier address for settlement.",
    ],
  },
  {
    title: "calculateDiscount()",
    subtitle: "Basis points for safe math.",
    slide: "Slide 38",
    overview:
      "Discounting uses basis points to avoid floating point math in Solidity.",
    commands: [
      "git checkout checkpoint-38-calculateDiscount",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    studentTodo: "Implement in contracts/FactoringContract.sol",
    studentCode: `// Student version (TODO)
function calculateDiscount(uint256 amount) public pure returns (uint256) {
    revert("TODO: calculateDiscount");
}`,
    referenceCode: `function calculateDiscount(uint256 amount)
    public
    pure
    returns (uint256)
{
    // 2% discount for early payment
    uint256 discountRate = 200; // basis points
    return amount - (amount * discountRate / 10000);
}`,
    notes: [
      "2% discount = 200 basis points.",
      "Pure function (no state reads/writes).",
    ],
  },
  {
    title: "settlePayment()",
    subtitle: "Buyer pays the financier.",
    slide: "Slide 39",
    overview:
      "The buyer pays the full invoice amount. The financier receives repayment in full.",
    commands: [
      "git checkout checkpoint-39-settlePayment",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    studentTodo: "Implement in contracts/FactoringContract.sol",
    studentCode: `// Student version (TODO)
function settlePayment(uint256 _invoiceId)
    external
    payable
    onlyBuyer(_invoiceId)
    inStatus(_invoiceId, InvoiceStatus.Funded)
{
    revert("TODO: settlePayment");
}`,
    referenceCode: `function settlePayment(uint256 _invoiceId)
    external
    payable
    onlyBuyer(_invoiceId)
    inStatus(_invoiceId, InvoiceStatus.Funded)
{
    Invoice storage invoice = invoices[_invoiceId];
    require(msg.value >= invoice.amount, "Insufficient payment");

    invoice.status = InvoiceStatus.Settled;

    (bool ok, ) = payable(invoice.financier).call{value: invoice.amount}("");
    require(ok, "Transfer failed");

    emit InvoiceSettled(_invoiceId, block.timestamp);
}`,
    notes: [
      "Only the buyer can settle.",
      "Requires Funded status.",
      "Pays the financier in full.",
    ],
  },
  {
    title: "Admin Functions",
    subtitle: "Authorize and revoke participants.",
    slide: "Slide 40",
    overview:
      "Only the admin can authorize suppliers and buyers. Without authorization, invoices can’t be created or settled.",
    commands: [
      "git checkout checkpoint-40-admin",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    studentTodo: "Implement in contracts/FactoringContract.sol",
    studentCode: `// Student version (TODO)
function authorizeSupplier(address _supplier) external onlyAdmin {
    revert("TODO: authorizeSupplier");
}
function authorizeBuyer(address _buyer) external onlyAdmin {
    revert("TODO: authorizeBuyer");
}
function revokeSupplier(address _supplier) external onlyAdmin {
    revert("TODO: revokeSupplier");
}`,
    referenceCode: `function authorizeSupplier(address _supplier) external onlyAdmin {
    authorizedSuppliers[_supplier] = true;
}
function authorizeBuyer(address _buyer) external onlyAdmin {
    authorizedBuyers[_buyer] = true;
}
function revokeSupplier(address _supplier) external onlyAdmin {
    authorizedSuppliers[_supplier] = false;
}`,
    notes: [
      "Admin is set in the constructor.",
      "Suppliers and buyers must be authorized before use.",
    ],
  },
  {
    title: "Testing Intro",
    subtitle: "Sanity check the test runner.",
    slide: "Slide 41",
    overview:
      "A tiny test confirms the environment works before you debug contract logic.",
    commands: [
      "git checkout checkpoint-33-start",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    referenceCode: `it("tests document expected behavior", async function () {
  expect(true).to.equal(true);
});`,
  },
  {
    title: "Testing Framework Setup",
    subtitle: "Verify Hardhat + Chai + Ethers.",
    slide: "Slide 42",
    overview:
      "Before writing logic tests, confirm that the stack is wired correctly.",
    commands: [
      "git checkout checkpoint-33-start",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    referenceCode: `it("Hardhat + Chai + Ethers.js are available", async function () {
  expect(ethers).to.not.equal(undefined);
  expect(expect).to.be.a("function");
});`,
  },
  {
    title: "Test File Structure",
    subtitle: "Scaffold tests with beforeEach.",
    slide: "Slide 43",
    overview:
      "Use separate signers for admin, supplier, buyer, and financier.",
    commands: [
      "git checkout checkpoint-33-start",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    referenceCode: `const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FactoringContract", function () {
  let contract;
  let admin, supplier, buyer, financier;

  beforeEach(async function () {
    [admin, supplier, buyer, financier] = await ethers.getSigners();
    const FactoringContract = await ethers.getContractFactory("FactoringContract");
    contract = await FactoringContract.deploy();
    await contract.waitForDeployment();
  });

  describe("Invoice Creation", function () {
    // Tests here
  });
});`,
  },
  {
    title: "Test: Invoice Creation",
    subtitle: "Ensure the event and status are correct.",
    slide: "Slide 44",
    overview:
      "Authorizations must happen before invoice creation. Verify event arguments and status.",
    commands: [
      "git checkout checkpoint-33-start",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    referenceCode: `it("should create invoice with correct data", async function () {
  await contract.connect(admin).authorizeSupplier(supplier.address);
  await contract.connect(admin).authorizeBuyer(buyer.address);

  const amount = ethers.parseEther("1000");
  const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;

  await expect(
    contract.connect(supplier).createInvoice(buyer.address, amount, dueDate)
  )
    .to.emit(contract, "InvoiceCreated")
    .withArgs(1, supplier.address, buyer.address, amount);

  const invoice = await contract.invoices(1);
  expect(invoice.status).to.equal(0); // Created
});`,
  },
  {
    title: "Test: State Transitions",
    subtitle: "Only the buyer can approve.",
    slide: "Slide 45",
    overview:
      "Test both the unauthorized path and the successful approval.",
    commands: [
      "git checkout checkpoint-33-start",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    referenceCode: `it("should only allow buyer to approve", async function () {
  await contract.connect(admin).authorizeSupplier(supplier.address);
  await contract.connect(admin).authorizeBuyer(buyer.address);

  const amount = ethers.parseEther("100");
  const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;
  await contract.connect(supplier).createInvoice(buyer.address, amount, dueDate);

  await expect(contract.connect(supplier).approveInvoice(1)).to.be.revertedWith(
    "Not the buyer"
  );

  await expect(contract.connect(buyer).approveInvoice(1))
    .to.emit(contract, "InvoiceApproved")
    .withArgs(1, buyer.address);
});`,
  },
  {
    title: "Test: ETH Transfers",
    subtitle: "Funding transfers the discount to the supplier.",
    slide: "Slide 46",
    overview:
      "Confirm the supplier balance increases by the discounted amount.",
    commands: [
      "git checkout checkpoint-33-start",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    referenceCode: `it("should transfer correct amount on funding", async function () {
  await contract.connect(admin).authorizeSupplier(supplier.address);
  await contract.connect(admin).authorizeBuyer(buyer.address);

  const amount = ethers.parseEther("1000");
  const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;
  await contract.connect(supplier).createInvoice(buyer.address, amount, dueDate);
  await contract.connect(buyer).approveInvoice(1);
  await contract.connect(supplier).requestEarlyPayment(1);

  const discountedAmount = await contract.calculateDiscount(amount);
  const supplierBalanceBefore = await ethers.provider.getBalance(supplier.address);

  await contract.connect(financier).fund(1, { value: discountedAmount });

  const supplierBalanceAfter = await ethers.provider.getBalance(supplier.address);
  expect(supplierBalanceAfter - supplierBalanceBefore).to.equal(discountedAmount);
});`,
  },
  {
    title: "Test: Edge Cases",
    subtitle: "Guard rails for real-world behavior.",
    slide: "Slide 47",
    overview:
      "These tests validate revert messages and prevent unsafe actions.",
    commands: [
      "git checkout checkpoint-33-start",
      "npm test    # expect failures until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    referenceCode: `it("should reject zero amount", async function () {
  await contract.connect(admin).authorizeSupplier(supplier.address);
  await contract.connect(admin).authorizeBuyer(buyer.address);
  const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;

  await expect(
    contract.connect(supplier).createInvoice(buyer.address, 0, dueDate)
  ).to.be.revertedWith("Amount must be > 0");
});

it("should reject past due date", async function () {
  await contract.connect(admin).authorizeSupplier(supplier.address);
  await contract.connect(admin).authorizeBuyer(buyer.address);
  const amount = ethers.parseEther("100");
  const dueDate = Math.floor(Date.now() / 1000) - 1;

  await expect(
    contract.connect(supplier).createInvoice(buyer.address, amount, dueDate)
  ).to.be.revertedWith("Due date in the past");
});

it("should reject insufficient funding", async function () {
  await contract.connect(admin).authorizeSupplier(supplier.address);
  await contract.connect(admin).authorizeBuyer(buyer.address);

  const amount = ethers.parseEther("1000");
  const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;
  await contract.connect(supplier).createInvoice(buyer.address, amount, dueDate);
  await contract.connect(buyer).approveInvoice(1);
  await contract.connect(supplier).requestEarlyPayment(1);

  const discountedAmount = await contract.calculateDiscount(amount);
  await expect(
    contract.connect(financier).fund(1, { value: discountedAmount - 1n })
  ).to.be.revertedWith("Insufficient funds");
});

it("should reject non-buyer settlement", async function () {
  await contract.connect(admin).authorizeSupplier(supplier.address);
  await contract.connect(admin).authorizeBuyer(buyer.address);

  const amount = ethers.parseEther("500");
  const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;
  await contract.connect(supplier).createInvoice(buyer.address, amount, dueDate);
  await contract.connect(buyer).approveInvoice(1);
  await contract.connect(supplier).requestEarlyPayment(1);

  const discountedAmount = await contract.calculateDiscount(amount);
  await contract.connect(financier).fund(1, { value: discountedAmount });

  await expect(
    contract.connect(other).settlePayment(1, { value: amount })
  ).to.be.revertedWith("Not the buyer");
});

it("should reject insufficient settlement", async function () {
  await contract.connect(admin).authorizeSupplier(supplier.address);
  await contract.connect(admin).authorizeBuyer(buyer.address);

  const amount = ethers.parseEther("500");
  const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30;
  await contract.connect(supplier).createInvoice(buyer.address, amount, dueDate);
  await contract.connect(buyer).approveInvoice(1);
  await contract.connect(supplier).requestEarlyPayment(1);

  const discountedAmount = await contract.calculateDiscount(amount);
  await contract.connect(financier).fund(1, { value: discountedAmount });

  await expect(
    contract.connect(buyer).settlePayment(1, { value: amount - 1n })
  ).to.be.revertedWith("Insufficient payment");
});`,
  },
  {
    title: "Run Tests",
    subtitle: "Expect failures until TODOs are implemented.",
    slide: "Slide 48",
    overview:
      "Once your contract and tests are complete, you can run targeted tests or the full suite.",
    commands: [
      "git checkout checkpoint-33-start",
      "npm test    # expect failures until tests are implemented",
      "npx hardhat test --grep \"Slide 44\"    # runs a single test",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
  },
  {
    title: "Code Coverage",
    subtitle: "Aim for 100% on critical paths.",
    slide: "Slide 49",
    overview:
      "Coverage reveals untested branches and access control issues.",
    commands: [
      "git checkout checkpoint-33-start",
      "npm run coverage    # will fail until tests are implemented",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
  },
  {
    title: "Checkpoint: Complete",
    subtitle: "Validate end-to-end flow.",
    slide: "Slide 50",
    overview:
      "If you want to see the full flow working, run the complete demo and tests.",
    commands: [
      "git checkout checkpoint-50-complete",
      "npm run test:complete",
      "npm run node    # Terminal A (keep running)",
      "npm run demo:complete    # Terminal B (requires Terminal A)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
    bullets: [
      "Contract compiles without errors",
      "All functions implemented",
      "Basic tests passing",
      "Ready for security review",
    ],
  },
  {
    title: "Common Issues",
    subtitle: "Fast fixes to typical errors.",
    slide: "Slide 51",
    overview:
      "Use this checklist when tests fail unexpectedly.",
    bullets: [
      "Stack too deep → use fewer locals",
      "Gas estimation failed → check require conditions",
      "Revert without reason → add error messages",
    ],
    commands: [
      "git checkout checkpoint-50-complete",
      "npm run test:complete",
      "npm run node    # Terminal A (keep running)",
      "npm run deploy:local    # Terminal B (requires Terminal A)",
    ],
  },
];
