import cors from "cors";
import crypto from "crypto";
import express from "express";
import axios from "axios";
import { nanoid } from "nanoid";

interface BlockInterface {
  index: string;
  previousHash: string;
  nonce: string;
  timestamp: string;
  data: string;
}

class Block {
  public block: BlockInterface;
  public difficulty: number;

  constructor(
    data: any,
    index: string,
    previousHash: string,
    difficulty: number
  ) {
    this.block = {
      index: index,
      data: JSON.stringify(data),
      timestamp: Date.now().toString(),
      nonce: "1",
      previousHash: previousHash,
    };

    this.difficulty = difficulty;
  }

  mine() {
    let nonce: string = "1";

    let hashed: boolean = false;

    console.log("mining...");

    while (!hashed) {
      const hash = this.hash({ ...this.block, nonce: nonce });

      if (this.proofOfWork(hash, nonce)) {
        // she cracked the puzzle
        hashed = true;
        this.block.nonce = nonce;
        console.log("mined...");
      }

      // she was not able yet hot!
      nonce = (parseInt(nonce) + 1).toString();
    }
  }

  hash(data: any): string {
    const order = (object: any) => {
      return Object.keys(object)
        .sort()
        .reduce((obj: any, key: any) => {
          obj[key] = object[key];
          return obj;
        }, {});
    };

    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(order(data)))
      .digest("hex");

    return hash;
  }

  getHash() {
    return this.hash(this.block);
  }

  checkValidity(): boolean {
    const hash = this.getHash();
    const zeroesArray = [];

    for (let i = 0; i < this.difficulty; i++) {
      zeroesArray.push("0");
    }

    if (this.proofOfWork(hash, this.block.nonce)) return true;

    return false;
  }

  proofOfWork(hash: string, nonce: string): boolean {
    // do all the complex logic here.
    const zeroesArray = [];

    for (let i = 0; i < this.difficulty; i++) {
      zeroesArray.push("0");
    }

    if (hash.substr(0, this.difficulty) === zeroesArray.join("")) return true;
    else return false;
  }
}

// the block chain

interface TransactionInterface {
  sender: any;
  receiver: any;
  amount: number;
}

class Blockchain {
  public chain: Block[];
  private readonly difficulty: number;
  private transactions: TransactionInterface[];
  public readonly nodes: Set<any>;

  constructor(difficulty: number) {
    this.chain = [];
    this.transactions = [];
    this.nodes = new Set();

    const zeroesArray = [];

    for (let i = 0; i < 64; i++) {
      zeroesArray.push("0");
    }

    if (!this.chain[0]) {
      const block = new Block(
        {
          hello: "dragon",
        },
        "0",
        zeroesArray.join(""),
        difficulty
      );

      this.createBlock(block);
    }

    this.difficulty = difficulty;
  }

  createBlock(block: Block): Block {
    block.mine();
    if (block.checkValidity()) {
      this.chain.push(block);
      this.transactions = [];
    }
    return block;
  }

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  getChain() {
    return this.chain.map((block) => {
      return {
        ...block.block,
        data: JSON.parse(block.block.data),
      };
    });
  }

  addBlock(): Block {
    const block = new Block(
      JSON.stringify(this.transactions),
      (this.chain.length - 1).toString(),
      this.chain[this.chain.length - 1].getHash(),
      this.difficulty
    );

    // the transaction to the miner.
    this.addTransaction({
      sender: myNodeAddress,
      receiver: "Babu-lal",
      amount: 12,
    });

    return this.createBlock(block);
  }

  addTransaction(data: TransactionInterface): number {
    this.transactions.push(data);

    return parseInt(this.getLastBlock().block.index) - 1;
  }

  addNode(url: string) {
    const node = new URL(url);
    this.nodes.add(node.origin);
  }

  replaceChain(): boolean {
    let longestChain: null | BlockInterface[] = null;
    let maxLength: number = this.chain.length;

    // loop through all nodes
    this.nodes.forEach(async (node) => {
      try {
        const {
          data: { chain, length, valid },
        } = await axios.get(`${node}/chain`);
        if (length > maxLength && valid == true) {
          // replace chain to the longest chain in network
          longestChain = chain;
          // change length to the new length
          maxLength = parseInt(length);
        }
      } catch (e) {}
    });

    // if chain is longer than the current chain replace the current chain.
    if (longestChain) {
      this.chain = longestChain;
      return true;
    } else return false;
  }

  checkValid(): boolean {
    let valid = true;

    this.chain.forEach((block, index) => {
      if (index !== 0) {
        // this is not genesis block
        const previousBlock = this.chain[index - 1];

        if (previousBlock.getHash() !== block.block.previousHash) {
          valid = false;
        }
      }
    });

    return valid;
  }
}

const blockChain = new Blockchain(1);

// node address
const myNodeAddress = nanoid(36);

// the express server

const app = express();

app.use(express.json());

app.use(cors());

app.get("/mine", (req, res) => {
  const block: Block = blockChain.addBlock();
  res.json(block.block);
});

app.get("/chain", (req, res) => {
  res.json({
    chain: blockChain.getChain(),
    length: blockChain.chain.length,
    valid: blockChain.checkValid(),
  });
});

app.get("/check-validity", (req, res) => {
  res.json({
    valid: blockChain.checkValid(),
  });
});

app.post("/add-transaction", (req, res) => {
  const { sender, receiver, amount } = req.body;
  try {
    if (sender && receiver && amount) {
      // data is valid
      const index = blockChain.addTransaction({
        sender,
        amount: parseFloat(amount),
        receiver,
      });

      res.status(200).json({
        message: `This transaction will be added to Block ${index}`,
      });
    } else
      res
        .status(400)
        .json({ message: "You fucked up. Why you betrayed me with falsey." });
  } catch (e) {
    res.status(500).json({
      message: "I fucked up sorry I don't know why",
    });
  }
});

app.post("/connect-nodes", (req, res) => {
  interface Nodes {
    nodes: Array<string> | null;
  }

  const { nodes }: Nodes = req.body;
  if (!nodes || !nodes.length)
    res.status(400).json({
      message: "You fucked up do not betray the chain.",
    });
  else {
    try {
      nodes.forEach((node, index) => {
        blockChain.addNode(node);
      });

      res.status(200).json({
        message: "You are so hot. I am not a gay so if you are a guy fuck up.",
        nodes: blockChain.nodes,
      });
    } catch (e) {
      res.status(500).json({
        message: "I fuck up! FUCKKKK!!!!",
      });
    }
  }
});

app.get("/replace-chain", async (req, res) => {
  const isChainReplaced = await blockChain.replaceChain();

  if (isChainReplaced) {
    res.status(200).json({
      message: "Chain was replaced by the longest chain.",
    });
  } else
    res.status(400).json({
      message: "I have the longest chain.",
    });
});

app.listen(3000, () => console.log("Server is up on http://localhost:3000"));
