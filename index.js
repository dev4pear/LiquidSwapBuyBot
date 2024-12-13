const { Aptos, AptosConfig, Network } = require("@aptos-labs/ts-sdk");
const { Telegraf } = require("telegraf");

const bot = new Telegraf("7633516993:AAHEYLd4lyQX7dN7QgYDC-UfAyb_6LB6GTM");
const config = new AptosConfig({ network: Network.MAINNET });
const aptosClient = new Aptos(config);

const accountAddress =
  "0x61d2c22a6cb7831bee0f48363b0eec92369357aece0d1142062f7d5d85c7bef8";
const creationNumber = "9604";

// Keep track of the last processed sequence number
let lastProcessedSequenceNumber = null;
let isFirstRun = true; // Flag to check if this is the first run
let chatId = null; // Store chat ID after /start is received

async function fetchAndProcessEvents() {
  try {
    const events = await aptosClient.getAccountEventsByCreationNumber({
      accountAddress,
      creationNumber,
    });

    let hasNewEvents = false;

    // Loop through each event to check if it is new and relevant
    for (const event of events) {
      const isNewEvent =
        lastProcessedSequenceNumber === null ||
        event.sequence_number > lastProcessedSequenceNumber;
      const isRelevantEvent = event.data.y_in !== "0";

      // Process the event only if it is new and meets the criteria
      if (isNewEvent && isRelevantEvent) {
        lastProcessedSequenceNumber = event.sequence_number;
        hasNewEvents = true;

        // Skip displaying events during the first run, just update the sequence number
        if (isFirstRun) {
          continue;
        }

        // Send the new event message if chatId is set
        if (chatId) {
          sendMessages(event, chatId);
        }

        // Display the new event in the console
        console.log("New event:", event);
      }
    }

    // Handle the first run: mark as complete and show initial state
    if (isFirstRun) {
      isFirstRun = false;

      if (hasNewEvents) {
        console.log("Initial setup done. Now waiting for new events...");
        console.log("Last sequence number:", lastProcessedSequenceNumber);
      } else {
        console.log("No events found during the initial setup.");
      }
    } else if (!hasNewEvents) {
      // If there are no new events after the initial run
      console.log("No new events.");
    }
  } catch (error) {
    console.error("Error fetching events:", error);
  }
}

function sendMessages(event, chatId) {
  const aptosAmount = (+event.data.y_in / 100000000).toFixed(2);
  const tokenAmount = (+event.data.x_out / 1000000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const transactioVersion = event.transaction_version;

  bot.telegram.sendMessage(
    chatId,
    `
Someone buys $NRUH!!!

Spent: ${aptosAmount} APT
Got: ${tokenAmount} NRUH

<a href="https://explorer.aptoslabs.com/txn/${transactioVersion}/balanceChange?network=mainnet" style="color: BLUE; text-decoration: none;">Transaction</a>
`,
    { parse_mode: "HTML", disable_web_page_preview: true }
  );
}

// Telegram bot command to start monitoring
bot.start((ctx) => {
  chatId = ctx.chat.id; // Save the chat ID to send messages to this chat
  ctx.reply("Bot started! You will receive updates on new events.");

  // Start polling for events
  fetchAndProcessEvents().then(() => {
    setInterval(fetchAndProcessEvents, 5000); // Poll every 5 seconds
  });
});

// Start the bot
bot.launch();

console.log("Bot is running. Type /start in Telegram to receive updates.");
