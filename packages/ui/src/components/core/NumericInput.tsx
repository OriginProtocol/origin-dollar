import { useState, useEffect, InputHTMLAttributes } from 'react';
import { isNaN, isNumber, isString } from 'lodash';
import { useKey } from '@originprotocol/hooks';

const IS_IOS =
  typeof navigator !== 'undefined'
    ? navigator.userAgent.match(/iPhone|iPad|iPod/i)
    : false;

const parseText = (text: string): string | number => {
  if (isNumber(text)) return text;

  if (isString(text)) {
    text = text.trim();
    if (!text) return '';
    const num = parseFloat(text);
    if (!isNaN(num)) {
      return num;
    }
  }

  return '';
};

const changeValue = (
  mod: string,
  value: number,
  max: number,
  min: number,
  step: number
) => {
  if (!value) {
    if (isNumber(min)) return min;
    return '';
  }

  value = mod === '+' ? value + step : value - step;

  if (isNumber(max) && value > max) return max;
  if (isNumber(min) && value < min) return min;

  const p = (step.toString().split('.')[1] || []).length;

  if (p) {
    return parseFloat(value.toFixed(p));
  }

  return value;
};

const Input = ({
  onChange,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => {
  function handleChange(e: any) {
    if (onChange) {
      onChange(e.target.value);
    }
  }
  return <input {...props} onChange={handleChange} />;
};

const NumericInput = ({
  step,
  min,
  max,
  value,
  onChange,
  enableMobileNumericKeyboard,
  ...props
}: any) => {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleChange = (text: string) => {
    const value = parseText(text);
    setText(text);
    if (onChange) {
      // @ts-ignore
      onChange(value);
    }
  };

  const handleWheel = (e: any) => {
    e.target.blur();
  };

  useKey('ArrowUp', () => {
    if (onChange) {
      // @ts-ignore
      onChange(changeValue('+', value, max, min, step));
    }
  });

  useKey('ArrowDown', () => {
    if (onChange) {
      // @ts-ignore
      onChange(changeValue('-', value, max, min, step));
    }
  });

  const inputProps = {
    value: text,
    onChange: handleChange,
    onWheel: handleWheel,
  };

  if (enableMobileNumericKeyboard) {
    return (
      // @ts-ignore
      <Input
        {...props}
        {...inputProps}
        type="number"
        inputMode="numeric"
        pattern={IS_IOS ? `[0-9]*` : ''}
        step={step}
        min={min}
        max={max}
      />
    );
  }

  // @ts-ignore
  return <Input {...props} {...inputProps} type="text" />;
};

NumericInput.defaultProps = {
  autoComplete: 'off',
  enableMobileNumericKeyboard: false,
  value: '',
  step: 1,
  min: 0,
};

export default NumericInput;
