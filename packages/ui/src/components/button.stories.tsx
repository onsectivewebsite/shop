import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'cta', 'secondary', 'outline', 'ghost', 'link', 'destructive'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Save changes' },
};

export const Cta: Story = {
  args: { variant: 'cta', size: 'lg', children: 'Buy now' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Cancel' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete account' },
};

export const Loading: Story = {
  args: { variant: 'primary', disabled: true, children: 'Saving…' },
};
