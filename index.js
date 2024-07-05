import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import moment from "moment";
import { sessionMiddleware } from "./src/middleware/session.js";
import route from "./src/route/routes.js";

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const port = process.env.PORT || 4000;

app.use(express.static(join(__dirname, "src", "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);
app.use("/", route);

// WebSocket
const userSessions = {};

io.engine.use(sessionMiddleware);

io.on("connection", (socket) => {
  const { id } = socket.request.session;
  console.log(id);
  if (!userSessions.hasOwnProperty(id)) {
    userSessions[id] = {
      currentOrderHistory: [],
      orderHistory: [],
      chatHistory: [],
      chatState: "initial",
    };
  }
  console.log("a user connected");

  const menu = {
    food: [
      // Modern food
      { id: "a", name: "Grilled Chicken Salad", price: 1500 },
      { id: "b", name: "Quinoa Bowl", price: 1300 },
      { id: "c", name: "Avocado Toast", price: 800 },
      { id: "d", name: "Vegan Burger", price: 1200 },
      { id: "e", name: "Sushi Platter", price: 2000 },
      { id: "f", name: "Gluten-Free Pizza", price: 1600 },
      // Rwandan local food
      { id: "g", name: "Isombe", price: 900 },
      { id: "h", name: "Ugali", price: 500 },
      { id: "i", name: "Brochettes", price: 700 },
      { id: "j", name: "Matoke", price: 600 },
      { id: "k", name: "Ibihaza", price: 650 }
    ],
    beverages: [
      { id: "l", name: "Water", price: 100 }, 
      { id: "m", name: "Soft Drink", price: 200 },
      { id: "n", name: "Juice", price: 300 },
    ],
  };

  const welcomeMessage = `
      <p> Please select an option from the choices below:</p>
      <p>1. Place an order</p>
      <p>97. See current order</p>
      <p>98. See order history</p>
      <p>99. Checkout order</p>
      <p>0. Cancel order</p>
    `;
  // Send initial options to the client
  socket.emit("message", {
    text: welcomeMessage,
  });

  let menuList = "<p>Select items (e.g., A2 for 2 Of Grilled Chicken Salad):</p>";

  menuList += "<p>Food:</p>";
  menu.food.forEach((item, index) => {
    const letter = String.fromCharCode(65 + index); // 65 is ASCII for 'A'
    menuList += `<p>${letter}. ${item.name} - $${item.price}</p>`;
  });
  
  menuList += "<p>Beverages:</p>";
  menu.beverages.forEach((item, index) => {
    const letter = String.fromCharCode(65 + index + menu.food.length); // Start from letter after food
    menuList += `<p>${letter}. ${item.name} - $${item.price}</p>`;
  });

  // Handle messages from client
  socket.on("message", (message) => {
    console.log("Message from client:", message);

    switch (message) {
      case "1":
        socket.emit("message", {
          text: menuList,
        });
        break;
      case "97":
        // Show current order
        console.log(userSessions[id].currentOrderHistory);
        if (userSessions[id].currentOrderHistory.length === 0) {
          socket.emit("message", {
            text: "Your current order is empty",
          });
        } else {
          let currOrderMsg = "<p>Your current order:</p>";
          userSessions[id].currentOrderHistory.forEach((order, index) => {
            currOrderMsg += `<p>${index + 1}. ${order.name} - $${order.price}</p>`; // Display name and price
          });
          socket.emit("message", {
            text: currOrderMsg,
          });
        }
        socket.emit("message", {
          text: welcomeMessage,
        });
        break;
      case "98":
        // Show order history
        const orderHistory = userSessions[id].orderHistory;
        if (!orderHistory.length) {
          socket.emit("message", {
            text: "You have not made an order before",
          });
          socket.emit("message", {
            text: welcomeMessage,
          });
          break;
        }
        let tableHtml = '<table border="1">';
        // Table headers
        tableHtml += "<tr><th>Order Content</th><th>Date</th><th>Total Price</th></tr>";
        // Iterate over each order in orderHistory
        orderHistory.forEach((order) => {
          // Create a row for each order
          tableHtml += `<tr><td>${order.orderContent}</td><td>${order.date}</td><td>$${order.totalPrice}</td></tr>`;
        });
        tableHtml += "</table>";
        socket.emit("message", {
          text: tableHtml,
        });
        socket.emit("message", {
          text: welcomeMessage,
        });
        break;
      case "99":
        // save/checkout order
        if (!userSessions[id].currentOrderHistory.length) {
          socket.emit("message", {
            text: "No order made",
          });
          socket.emit("message", {
            text: welcomeMessage,
          });
          break;
        }
        const orderContent = userSessions[id].currentOrderHistory;
        const totalPrice = orderContent.reduce((total, item) => total + item.price, 0);
        const data = {
          date: moment().format("MMMM Do YYYY, h:mm a"),
          orderContent: orderContent.map(item => `${item.name} - $${item.price}`).join("<br>"), // Format order content with names and prices
          totalPrice: totalPrice
        };
        userSessions[id].orderHistory.push(data);
        userSessions[id].currentOrderHistory = [];
        socket.emit("message", { text: "Order saved and sent" });
        socket.emit("message", {
          text: welcomeMessage,
        });
        break;
      case "0":
        // Cancel order
        userSessions[id].currentOrderHistory = [];
        socket.emit("message", { text: "Order cancelled" });
        socket.emit("message", {
          text: welcomeMessage,
        });
        break;
        
      default:
        const itemPattern = /([A-Za-z])(\d*)/; // Pattern to capture item and optional quantity
        const selectedItems = message.split(",");
        let validSelection = true;
        
        selectedItems.forEach(selection => {
          const match = selection.match(itemPattern);
          if (!match) {
            validSelection = false;
            return;
          }
          
          const letter = match[1].toUpperCase();
          const quantity = parseInt(match[2], 10) || 1; // Default quantity is 1 if not specified
          
          let menuItem;
          if (letter >= "A" && letter < String.fromCharCode(65 + menu.food.length)) {
            menuItem = menu.food[letter.charCodeAt(0) - 65];
          } else if (letter >= String.fromCharCode(65 + menu.food.length) && letter < String.fromCharCode(65 + menu.food.length + menu.beverages.length)) {
            menuItem = menu.beverages[letter.charCodeAt(0) - 65 - menu.food.length];
          }
          
          if (!menuItem) {
            validSelection = false;
            return;
          }
          
          for (let i = 0; i < quantity; i++) {
            userSessions[id].currentOrderHistory.push(menuItem);
          }
        });
        
        if (!validSelection) {
          socket.emit("message", {
            text: "Invalid option. Please choose again.",
          });
        } else {
          socket.emit("message", {
            text: "Items ordered successfully!",
          });
          socket.emit("message", {
            text: welcomeMessage,
          });
        }
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

httpServer.listen(port, () => {
  console.log(`Server started on port: ${port}`);
});



