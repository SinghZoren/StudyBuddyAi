import re
import json
from dotenv import load_dotenv
import os

from sympy import (
    symbols, integrate, diff, simplify, solve, 
    sympify, latex, limit, expand, factor
)
from anthropic import Anthropic

load_dotenv()
APIKEY = os.getenv("APIKEY")

# Initialize Anthropic client with direct API key
anthropic = Anthropic(api_key=APIKEY)  # Replace with your actual API key

def is_math_query(query):
    """Check if the query is a direct math operation."""
    math_operations = [
        r'^\s*integrate\s*\(',
        r'^\s*differentiate\s*\(',
        r'^\s*simplify\s*\(',
        r'^\s*solve\s*\(',
        r'^\s*expand\s*\(',
        r'^\s*factor\s*\(',
        r'^\s*roots\s*\(',
        r'^\s*limits\s*\(',
        r'^\s*evaluate\s*\('
    ]
    return any(re.match(pattern, query.lower()) for pattern in math_operations)

def is_visualization_request(query):
    """Check if the query is requesting a visualization."""
    viz_keywords = [
        'visual', 'visualize', 'visualization', 'graph', 'plot', 'simulate',
        'simulation', 'show me', 'display', 'demonstrate', 'draw', 'create',
        'example', 'interactive', 'animation', 'demonstrate'
    ]
    return any(keyword in query.lower() for keyword in viz_keywords)

def generate_visualization_component(query):
    system_message = """You are a specialized coding assistant that converts visualization requests into React components. 
Return ONLY the React component code that follows these rules:

1. DO NOT use JSX syntax - use React.createElement instead
2. DO NOT include any import statements
3. DO NOT include export statements
4. The following dependencies are automatically available:
   - React (and hooks)
   - Recharts components: LineChart, BarChart, AreaChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend
   - lodash as _
   - mathjs as math

Example format:
return function VisualizationComponent() {
    // State handling if needed
    const [state, setState] = React.useState(initialValue);
    
    // Return using React.createElement instead of JSX
    return React.createElement('div', { className: 'w-full p-4' },
        React.createElement(LineChart, { width: 600, height: 300 },
            React.createElement(XAxis, { dataKey: 'name' }),
            React.createElement(YAxis),
            React.createElement(CartesianGrid, { strokeDasharray: '3 3' }),
            React.createElement(Tooltip),
            React.createElement(Legend),
            React.createElement(Line, { 
                type: 'monotone',
                dataKey: 'value',
                stroke: '#8884d8'
            })
        )
    );
}
"""

    try:
        message = anthropic.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            temperature=0.7,
            system=system_message,
            messages=[{
                "role": "user",
                "content": f"Create an interactive React component that visualizes: {query}. Return ONLY the component code, no explanations."
            }]
        )

        # Extract just the code from Claude's response
        component_code = message.content[0].text.strip()
        
        # Remove any markdown code blocks if present
        if component_code.startswith("```"):
            component_code = "\n".join(component_code.split("\n")[1:-1])
            
        # Ensure the code has necessary structure
        if not "export default" in component_code:
            component_code += "\nexport default VisualizationComponent;"

        # Return in the expected format
        return json.dumps({
            "type": "react_component",
            "content": component_code
        })

    except Exception as e:
        print(f"[ERROR] Visualization generation error: {e}")
        return fallback_general_text(query)
    
def fallback_general_text(user_question):
    """Use Claude for general responses and explanations."""
    system_message = """You are a Study Buddy AI designed to help students learn and solve problems.
    Your responses should be:
    1. Clear and educational
    2. Include step-by-step explanations when appropriate
    3. Use LaTeX notation (wrapped in \\( and \\)) for mathematical expressions
    4. Friendly and encouraging
    
    If a concept could benefit from visualization, mention that the user can 
    ask for a visual demonstration."""

    try:
        message = anthropic.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            temperature=0.7,
            system=system_message,
            messages=[{
                "role": "user",
                "content": user_question
            }]
        )
        return message.content[0].text

    except Exception as e:
        print(f"[ERROR] Claude API error: {e}")
        return "I apologize, but I'm having trouble processing your request. Could you please try again?"
    
def handle_claude_response(query):
    """Handle general questions using Claude."""
    system_message = """You are a Study Buddy AI designed to help students learn and solve problems.
    Your responses should be:
    1. Clear and educational
    2. Include step-by-step explanations when appropriate
    3. Use LaTeX notation (wrapped in \\( and \\)) for any mathematical expressions
    4. Friendly and encouraging
    
    For math concepts, provide both explanations and examples.
    If a concept could benefit from visualization, mention that the user can ask for a visual demonstration."""

    try:
        message = anthropic.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            temperature=0.7,
            system=system_message,
            messages=[{
                "role": "user",
                "content": query
            }]
        )
        return message.content[0].text
    except Exception as e:
        print(f"[ERROR] Claude API error: {e}")
        return "I'm having trouble connecting to my knowledge base right now. Could you please try again?"

def process_math_expression(operation, expression):
    """Process pure mathematical expressions."""
    try:
        x, y, n = symbols('x y n')
        expr = sympify(expression)
        
        operations = {
            "integrate": lambda e: integrate(e, x),
            "differentiate": lambda e: diff(e, x),
            "simplify": lambda e: simplify(e),
            "solve": lambda e: solve(e, x),
            "expand": lambda e: expand(e),
            "factor": lambda e: factor(e),
            "roots": lambda e: solve(e, x),
            "limits": lambda e: limit(e, x, 0),
            "evaluate": lambda e: e.subs(x, 1)
        }
        
        if operation in operations:
            result = operations[operation](expr)
            return f"\\({latex(result)}\\)"
        
    except Exception as e:
        print(f"[ERROR] Math processing error: {e}")
        return None

def process_text(user_question):
    """Main processing function for all queries."""
    # Strip whitespace and handle empty queries
    if not user_question or not user_question.strip():
        return "Please ask me a question!"

    user_question = user_question.strip()
    
    # Check if it's a visualization request
    if is_visualization_request(user_question):
        return generate_visualization_component(user_question)
    
    # Check if it's a direct math operation
    if is_math_query(user_question):
        # Extract operation and expression
        match = re.match(r'(\w+)\((.*)\)$', user_question)
        if match:
            operation, expression = match.groups()
            result = process_math_expression(operation, expression)
            if result:
                return result
    
    # For everything else, use Claude's response
    return handle_claude_response(user_question)