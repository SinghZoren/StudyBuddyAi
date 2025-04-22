document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // MathQuill + Chat logic
  // =========================
  if (typeof MathQuill === "undefined") {
      console.error("MathQuill is not loaded!");
      return;
  }

  // Initialize MathQuill
  const MQ = MathQuill.getInterface(2);
  const mathField = MQ.MathField(document.getElementById("mathquill-input"), {
      spaceBehavesLikeTab: true,
      handlers: {
          edit: function () {
              console.log("MathQuill input changed.");
          },
      },
  });

  // Elements
  const mathModeToggle = document.getElementById("math-mode-toggle");
  const latexInputContainer = document.getElementById("latex-input-container");
  const questionInput = document.getElementById("question-input");
  const sendButton = document.getElementById("send-button");
  const chatBox = document.getElementById("chat-box");
  const mathActionSelector = document.getElementById("math-action-selector");
  const visualizationContainer = document.getElementById("visualization-container");

  const operationTemplates = {
      integrate: "\\int_{a}^{b} f(x) dx",
      differentiate: "\\frac{d}{dx} f(x)",
      simplify: "f(x)",
      solve: "f(x) = 0",
      factorize: "f(x)",
      expand: "(a+b)^n",
      evaluate: "f(x) \\mid_{x=a}",
      roots: "f(x) = 0",
      limits: "\\lim_{x \\to a} f(x)",
      "implicit differentiate": "\\frac{d}{dx} f(x,y)",
      "definite integrate": "\\int_{a}^{b} f(x) dx",
      matrix: "\\begin{bmatrix} ? & ? \\\\ ? & ? \\end{bmatrix}",
      "partial differentiate": "\\frac{\\partial}{\\partial x} f(x, y)",
      "critical-points": "\\nabla f(x, y) = 0",
      series: "\\sum_{n=a}^{b} f(n)",
  };

  let watermarkElement;

  function updateMathQuillPreview() {
      const selectedAction = mathActionSelector.value;
      const watermark = selectedAction.replace(/-/g, " ");
      const template = operationTemplates[selectedAction] || "";

      mathField.latex(template);

      if (!watermarkElement) {
          watermarkElement = document.createElement("div");
          watermarkElement.style.position = "absolute";
          watermarkElement.style.top = "5px";
          watermarkElement.style.left = "10px";
          watermarkElement.style.fontSize = "14px";
          watermarkElement.style.color = "rgba(0, 0, 0, 0.3)";
          watermarkElement.style.pointerEvents = "none";
          watermarkElement.style.zIndex = "-1";
          latexInputContainer.appendChild(watermarkElement);
      }
      watermarkElement.textContent = watermark;
  }

  // =========================
  // Visualization Handling
  // =========================

  // Define this at the top level of scripts.js, outside of any other functions
  window.createVisualizationComponent = function(code) {
    try {
        // Remove import statements and export statements
        const cleanedCode = code
            .replace(/import.*?;(\r\n|\n|\r)/g, '')
            .replace(/export default.*?;?(\r\n|\n|\r)?$/, '')
            .trim();

        // Wrap the code with proper React component structure
        const wrappedCode = `
            function VisualizationComponent() {
                // Get dependencies from arguments
                const React = arguments[0];
                const Recharts = arguments[1];
                const _ = arguments[2];
                const math = arguments[3];

                // Destructure Recharts components
                const { 
                    LineChart, BarChart, AreaChart, Line, Bar, Area,
                    XAxis, YAxis, CartesianGrid, Tooltip, Legend
                } = Recharts;

                // Return the component's JSX using React.createElement directly
                ${cleanedCode}
            }
            return VisualizationComponent;
        `;
        
        // Create the component function with direct React reference
        const ComponentFunction = new Function(
            'React',
            'Recharts',
            '_',
            'math',
            wrappedCode
        );

        // Return component with dependencies bound
        return ComponentFunction.bind(null, window.React, window.Recharts, window._, window.math);
        
    } catch (error) {
        console.error('Error in createVisualizationComponent:', error);
        throw error;
    }
};

function createVisualizationComponent(componentCode) {
    try {
        // Create wrapper div
        const vizDiv = document.createElement('div');
        vizDiv.className = 'visualization-wrapper bg-white rounded-lg shadow-lg p-4 mb-4 relative';
        vizDiv.style.minHeight = '300px';
        
        // Container for React component
        const componentContainer = document.createElement('div');
        componentContainer.id = 'viz-container-' + Date.now();
        componentContainer.className = 'react-component-container';
        componentContainer.style.width = '100%';
        componentContainer.style.height = '100%';
        vizDiv.appendChild(componentContainer);
        
        // Close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.className = 'absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl font-bold cursor-pointer';
        closeButton.onclick = () => vizDiv.remove();
        vizDiv.appendChild(closeButton);
        
        // Add to chat
        chatBox.appendChild(vizDiv);

        try {
            // Get the Component constructor
            const ComponentConstructor = window.createVisualizationComponent(componentCode);
            
            // Create element with safety check
            if (!window.React || !window.React.createElement) {
                throw new Error('React is not properly loaded');
            }

            // Create the component element
            const element = window.React.createElement(ComponentConstructor);
            
            // Render with safety check
            if (!window.ReactDOM || !window.ReactDOM.render) {
                throw new Error('ReactDOM is not properly loaded');
            }

            // Render the component
            window.ReactDOM.render(
                element,
                componentContainer
            );

        } catch (error) {
            console.error('Component creation/render error:', error);
            componentContainer.innerHTML = `
                <div class="p-4 bg-red-100 text-red-700 rounded">
                    <h3>Error creating visualization:</h3>
                    <p>${error.message}</p>
                    <pre class="mt-2 text-sm">${error.stack}</pre>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Outer visualization error:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'visualization-error p-4 bg-red-100 text-red-700 rounded';
        errorDiv.textContent = 'Error: ' + error.message;
        chatBox.appendChild(errorDiv);
    }
}

function addMessageToChat(message, sender) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("chat-message", sender);

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");

  try {
    // Try parsing as JSON for potential visualization
    const messageData = JSON.parse(message);
    if (messageData.type === "react_component") {
      try {
        // Show loading message
        bubble.textContent = "Creating visualization...";
        messageElement.appendChild(bubble);
        chatBox.appendChild(messageElement);
        
        // Create visualization
        const vizContainer = document.createElement('div');
        vizContainer.className = 'visualization-wrapper bg-white rounded-lg shadow-lg p-4 mb-4 relative';
        
        const componentContainer = document.createElement('div');
        componentContainer.id = 'viz-container-' + Date.now();
        componentContainer.className = 'react-component-container';
        vizContainer.appendChild(componentContainer);
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.className = 'absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl font-bold cursor-pointer';
        closeButton.onclick = () => vizContainer.remove();
        vizContainer.appendChild(closeButton);
        
        chatBox.appendChild(vizContainer);

        // Create and render the component
        try {
          const Component = window.createVisualizationComponent(messageData.content);
          ReactDOM.render(
            React.createElement(Component),
            document.getElementById(componentContainer.id)
          );
          
          // Update success message
          bubble.textContent = "Here's your visualization:";
          
        } catch (componentError) {
          console.error('Component creation error:', componentError);
          componentContainer.innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded">Error creating visualization: ${componentError.message}</div>`;
          bubble.textContent = "Error in visualization creation.";
        }
        
      } catch (vizError) {
        console.error('Visualization wrapper error:', vizError);
        bubble.textContent = "Sorry, there was an error creating the visualization.";
      }
      return;
    }
  } catch (e) {
    // Not JSON, continue with normal message handling
  }

  // Existing message handling logic
  if (sender === "user" && mathModeToggle.checked) {
    // User message with MathQuill
    bubble.innerHTML = `
      <span style="font-size:12px; font-style:italic; color:rgba(0,0,0,0.5); display:block;">
      ${message.split("(")[0].replace(/-/g, " ")}
      </span>
      \\(${message.split("(")[1]}\\)
    `;
    MathJax.typesetPromise([bubble]);
  } else if (message.includes("\\(") && message.includes("\\)")) {
    // Bot response with LaTeX content
    bubble.innerHTML = message;
    MathJax.typesetPromise([bubble]);
  } else {
    // Plain text (fallback)
    bubble.textContent = message;
  }

  messageElement.appendChild(bubble);
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}

  function sendMessage() {
      let userMessage;
      if (mathModeToggle.checked) {
          const selectedAction = mathActionSelector.value;
          const latexInput = mathField.latex().trim();
          if (!latexInput) {
              alert("Please provide a valid input in the MathQuill field.");
              return;
          }
          userMessage = `${selectedAction}(${latexInput})`;
      } else {
          userMessage = questionInput.value.trim();
      }

      if (!userMessage) return;

      addMessageToChat(userMessage, "user");

      fetch("/api/question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: userMessage }),
      })
      .then((res) => {
          if (!res.ok) throw new Error("Network response was not ok");
          return res.json();
      })
      .then((data) => {
          addMessageToChat(data.response || "No response received.", "bot");
      })
      .catch((err) => {
          console.error(err);
          addMessageToChat("An error occurred. Please try again.", "bot");
      });

      if (mathModeToggle.checked) {
          mathField.latex("");
      } else {
          questionInput.value = "";
      }
  }

  // Event Listeners
  mathActionSelector.addEventListener("change", updateMathQuillPreview);
  
  mathModeToggle.addEventListener("change", function() {
      if (this.checked) {
          latexInputContainer.style.display = "flex";
          questionInput.style.display = "none";
          updateMathQuillPreview();
      } else {
          latexInputContainer.style.display = "none";
          questionInput.style.display = "block";
      }
  });

  sendButton.addEventListener("click", sendMessage);
  
  document.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
          if (event.shiftKey) {
              if (!mathModeToggle.checked) {
                  const cursorPos = questionInput.selectionStart;
                  questionInput.value =
                      questionInput.value.substring(0, cursorPos) +
                      "\n" +
                      questionInput.value.substring(cursorPos);
                  questionInput.selectionStart = questionInput.selectionEnd = cursorPos + 1;
              }
          } else {
              event.preventDefault();
              sendMessage();
          }
      }
  });

  // =========================
  // Dark Mode
  // =========================
  const darkModeBtn = document.getElementById("dark-mode-toggle");
  if (darkModeBtn) {
      darkModeBtn.addEventListener("click", () => {
          document.body.classList.toggle("dark-mode");
          // Update visualization themes if needed
          const isDarkMode = document.body.classList.contains("dark-mode");
          document.querySelectorAll('.visualization-wrapper').forEach(wrapper => {
              wrapper.style.backgroundColor = isDarkMode ? '#2d2d2d' : 'white';
          });
      });
  }

  // =========================
  // Auth Modal Logic
  // =========================
  const authButton = document.getElementById("auth-button");
  const authModal = document.getElementById("auth-modal");
  const closeBtn = authModal.querySelector(".close");
  const showLoginBtn = document.getElementById("show-login");
  const showRegisterBtn = document.getElementById("show-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  authButton.addEventListener("click", () => {
      authModal.style.display = "block";
  });
  closeBtn.addEventListener("click", () => {
      authModal.style.display = "none";
  });
  window.addEventListener("click", (e) => {
      if (e.target === authModal) {
          authModal.style.display = "none";
      }
  });

  showLoginBtn.addEventListener("click", () => {
      loginForm.style.display = "block";
      registerForm.style.display = "none";
      showLoginBtn.classList.add("active");
      showRegisterBtn.classList.remove("active");
  });
  showRegisterBtn.addEventListener("click", () => {
      loginForm.style.display = "none";
      registerForm.style.display = "block";
      showLoginBtn.classList.remove("active");
      showRegisterBtn.classList.add("active");
  });

  // =========================
  // Password Strength
  // =========================
  const regPassword = document.getElementById("reg-password");
  const regPassword2 = document.getElementById("reg-password2");
  const passwordStrengthMsg = document.getElementById("password-strength-msg");

  regPassword.addEventListener("input", checkPasswordStrength);
  regPassword2.addEventListener("input", checkPasswordMatch);

  function checkPasswordStrength() {
      const pwd = regPassword.value;
      let score = 0;

      // Criteria: length 7-12
      if (pwd.length >= 7 && pwd.length <= 12) score++;
      // Has uppercase
      if (/[A-Z]/.test(pwd)) score++;
      // Has digit
      if (/\d/.test(pwd)) score++;
      // Has special symbol
      if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;

      updatePasswordBar(score);
  }

  function updatePasswordBar(score) {
      const bar = document.getElementById("password-strength-bar");
      let width = 0;
      let color = "red";
      let text = "Very weak";

      switch (score) {
          case 0:
              width = 0;
              color = "red";
              text = "Very weak";
              break;
          case 1:
              width = 25;
              color = "red";
              text = "Weak password";
              break;
          case 2:
              width = 50;
              color = "orange";
              text = "Medium strength";
              break;
          case 3:
              width = 75;
              color = "#fbc02d";
              text = "Almost strong";
              break;
          case 4:
              width = 100;
              color = "green";
              text = "Strong password";
              break;
      }

      bar.style.width = width + "%";
      bar.style.backgroundColor = color;
      passwordStrengthMsg.textContent = text;
      passwordStrengthMsg.style.color = color;
  }

  function checkPasswordMatch() {
      if (regPassword.value && regPassword2.value &&
          regPassword.value !== regPassword2.value) {
          passwordStrengthMsg.textContent = "Passwords do not match!";
          passwordStrengthMsg.style.color = "red";
      } else {
          checkPasswordStrength();
      }
  }

  // Example stubs for login/register fetch
  const loginSubmit = document.getElementById("login-submit");
  const registerSubmit = document.getElementById("register-submit");

  loginSubmit.addEventListener("click", () => {
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      alert("(Demo) Logging in with: " + email + " / " + password);
      authModal.style.display = "none";
  });

  registerSubmit.addEventListener("click", () => {
      const email = document.getElementById("reg-email").value;
      const pwd1 = regPassword.value;
      const pwd2 = regPassword2.value;
      if (pwd1 !== pwd2) {
          alert("Passwords do not match!");
          return;
      }
      alert("(Demo) Registering with: " + email + " / " + pwd1);
      authModal.style.display = "none";
  });
});