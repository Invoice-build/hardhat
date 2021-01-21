const { expect } = require('chai')

describe('InvoiceBuild minting', function() {
  let InvoiceBuild, invoiceBuild, owner, signer1, signer2, recipient1, recipient2, params

  beforeEach(async function () {
    [owner, signer1, signer2, recipient1, recipient2] = await ethers.getSigners()
    params = {
      amount: ethers.utils.parseUnits('100', 'ether'),
      recipient: recipient1.address,
      dueAt: 0, // 0 = on reciept, equiv to no due date, can't be overdue
      overdueInterest: 0,
      metaUrl: 'https://invoice.build'
    }

    InvoiceBuild = await ethers.getContractFactory('InvoiceBuild')
    invoiceBuild = await InvoiceBuild.deploy()

    await invoiceBuild.connect(signer1).create(...Object.values(params))
  })

  it('Should be owned by signer', async function () {
    expect(await invoiceBuild.ownerOf(1)).to.equal(signer1.address)
  })

  it('Should have correct tokenURI', async function () {
    expect(await invoiceBuild.tokenURI(1)).to.equal(params.metaUrl)
  })

  it('should have unique tokenURIs', async function () {
    const params2 = Object.assign({}, params, {
      metaUrl: 'https://invoice.build/2',
      recipient: recipient2.address
    })
    await invoiceBuild.connect(signer2).create(...Object.values(params2))
    expect(await invoiceBuild.tokenURI(1)).to.equal(params.metaUrl)
    expect(await invoiceBuild.tokenURI(2)).to.equal(params2.metaUrl)
  })

  it('Should add id to owners invoice map', async function () {
    const params2 = Object.assign({}, params, { recipient: recipient2.address })
    await invoiceBuild.connect(signer2).create(...Object.values(params2))
    await invoiceBuild.connect(signer1).create(...Object.values(params))
    const ids = (await invoiceBuild.invoicesForOwner(signer1.address)).map(id => id.toNumber())
    expect(ids).to.eql([1,3])
  })

  it('Increments total supply', async function () {
    await invoiceBuild.connect(signer2).create(...Object.values(params))
    const totalSupply = (await invoiceBuild.connect(owner).totalSupply()).toNumber()
    expect(totalSupply).to.equal(2)
  })

  it('Returns number of invoices owned', async function () {
    await invoiceBuild.connect(signer1).create(...Object.values(params))
    await invoiceBuild.connect(signer2).create(...Object.values(params))
    const count1 = (await invoiceBuild.connect(owner).balanceOf(signer1.address)).toNumber()
    const count2 = (await invoiceBuild.connect(owner).balanceOf(signer2.address)).toNumber()
    expect(count1).to.equal(2)
    expect(count2).to.equal(1)
  })

  it('Returns oustanding amount for token', async function () {
    const timestamp = +new Date()
    let outstanding = await invoiceBuild.invoiceOutstanding(1, timestamp)
    outstanding = parseFloat(ethers.utils.formatUnits(outstanding, 'ether'))
    expect(outstanding).to.equal(100.0)
  })

  it('Returns withdrawable balance for token', async function () {
    let balance = await invoiceBuild.invoiceBalance(1)
    balance = parseFloat(ethers.utils.formatUnits(balance, 'ether'))
    expect(balance).to.equal(0.0)
  })

  it('Returns amount for token', async function () {
    let amount = await invoiceBuild.invoiceAmount(1)
    amount = parseFloat(ethers.utils.formatUnits(amount, 'ether'))
    expect(amount).to.equal(100.0)
  })

  it('Sets isPaid to false', async function () {
    expect(await invoiceBuild.isPaid(1)).to.be.false
  })

  it('Sets dueAt', async function () {
    const dueAt = +new Date() + 1000
    const params2 = Object.assign({}, params, { dueAt })
    await invoiceBuild.connect(signer1).create(...Object.values(params2))

    expect((await invoiceBuild.dueAt(1)).toNumber()).to.equal(0)
    expect((await invoiceBuild.dueAt(2)).toNumber()).to.equal(dueAt)
  })

  it('Sets overdueInterest', async function () {
    expect((await invoiceBuild.overdueInterest(1)).toNumber()).to.equal(0)

    const overdueInterest = ethers.utils.parseUnits((8 / 100).toString(), 'ether') // 8%
    const params2 = Object.assign({}, params, { overdueInterest })
    await invoiceBuild.connect(signer1).create(...Object.values(params2))

    let interest = await invoiceBuild.overdueInterest(2)
    interest = parseFloat(ethers.utils.formatUnits(interest, 'ether'))
    expect(interest).to.equal(0.08)
  })

  it('Sets lateFees', async function () {
    expect((await invoiceBuild.lateFees(1)).toNumber()).to.equal(0)
  })

  it('Prevents zero amount invoice', async function () {
    try {
      const params2 = Object.assign({}, params, { amount: '0' })
      await invoiceBuild.connect(signer1).create(...Object.values(params2))
    } catch (error) {
      expect(error.message).to.include('Amount too low')
    }
  })

  it('Prevents negative amount invoice', async function () {
    try {
      const params2 = Object.assign({}, params, { amount: '-100' })
      await invoiceBuild.connect(signer1).create(...Object.values(params2))
    } catch (error) {
      expect(error.message).to.include('value out-of-bounds')
    }
  })
})
