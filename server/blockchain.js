const crypto = require('crypto');

const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

function calculateHash(userData, issuedAt, validUntil, previousHash) {
  const dataStr = JSON.stringify({
    userId: userData.id || userData.user_id,
    name: userData.name,
    email: userData.email,
    idProof: userData.id_proof_number || userData.idProof
  });
  
  const payload = `${dataStr}_${new Date(issuedAt).toISOString()}_${new Date(validUntil).toISOString()}_${previousHash}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function verifyChain(blocks, users) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const user = users.find(u => u.id === block.user_id);
    
    if (!user) {
      return {
        verified: false,
        error: `User not found for Digital ID #${block.id}`,
        blockId: block.id
      };
    }

    // Determine expected previous hash
    const expectedPrevHash = i === 0 ? GENESIS_HASH : blocks[i - 1].id_hash;
    if (block.previous_hash !== expectedPrevHash) {
      return {
        verified: false,
        error: `Chain broken at block #${block.id}. Previous hash does not match previous block's hash.`,
        blockId: block.id,
        expectedPreviousHash: expectedPrevHash,
        actualPreviousHash: block.previous_hash
      };
    }

    // Recalculate block hash
    const recalculated = calculateHash(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        id_proof_number: user.id_proof_number
      },
      block.issued_at,
      block.valid_until,
      block.previous_hash
    );

    if (block.id_hash !== recalculated) {
      return {
        verified: false,
        error: `Data tampering detected at block #${block.id}. Recalculated hash does not match stored block hash.`,
        blockId: block.id,
        recalculatedHash: recalculated,
        storedHash: block.id_hash
      };
    }
  }

  return { verified: true, chainLength: blocks.length };
}

module.exports = {
  calculateHash,
  verifyChain,
  GENESIS_HASH
};
